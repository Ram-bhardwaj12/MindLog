import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// 1. Initialize MongoMemoryServer
const mongod = await MongoMemoryServer.create();
const testMongoUri = mongod.getUri();

// 2. Configure test environment variables BEFORE importing app or env modules
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = testMongoUri;
process.env.JWT_SECRET = 'test_jwt_secret_must_be_minimum_32_characters_long_for_security';
process.env.JWT_EXPIRES_DAYS = '7';
process.env.COOKIE_NAME = 'mindlog_token';
process.env.COOKIE_SAMESITE = 'lax';
process.env.BCRYPT_SALT_ROUNDS = '4'; // Fast for tests
process.env.CLIENT_ORIGINS = 'http://localhost:5173';

// 3. Connect Mongoose to the in-memory database
await mongoose.connect(testMongoUri);

// 4. Import app, User model, and env
const { default: app } = await import('../../src/app.js');
const { User } = await import('../../src/models/User.js');
const { env } = await import('../../src/config/env.js');

describe('Authentication Integration Tests (Using MongoMemoryServer)', () => {
  before(async () => {
    // Ensure unique indexes are built in the memory server
    await User.init();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('registers user, sets HttpOnly cookie, and returns user profile without secrets', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'author@mindlog.app',
          password: 'Password123!',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, 'author@mindlog.app');
      assert.equal(typeof res.body.data.user.id, 'string');
      assert.ok(res.body.data.user.createdAt);

      // Verify no sensitive fields leaked in response body
      assert.equal(res.body.data.user.passwordHash, undefined);
      assert.equal(res.body.data.token, undefined);
      assert.equal(res.body.data.user._id, undefined);
      assert.equal(res.body.data.user.__v, undefined);

      // Verify Set-Cookie header
      const cookies = res.headers['set-cookie'];
      assert.ok(cookies, 'Expected set-cookie header');
      const cookieStr = cookies[0];

      assert.ok(cookieStr.includes('mindlog_token='));
      assert.ok(cookieStr.toLowerCase().includes('httponly'));
      assert.ok(cookieStr.includes('Path=/'));
      assert.ok(cookieStr.toLowerCase().includes('samesite=lax'));
      assert.ok(cookieStr.includes('Max-Age=604800')); // 7 days in seconds

      // Verify database record has valid bcrypt hash
      const dbUser = await User.findOne({ email: 'author@mindlog.app' }).select('+passwordHash');
      assert.ok(dbUser);
      assert.notEqual(dbUser.passwordHash, 'Password123!');
      assert.ok(dbUser.passwordHash.startsWith('$2'), 'Expected bcrypt hash prefix');
    });

    it('rejects duplicate email with 409 CONFLICT (case-insensitive)', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'duplicate@example.com', password: 'Password123!' });

      // Second registration with uppercase
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'DUPLICATE@example.com', password: 'AnotherPassword123!' });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'CONFLICT');
      assert.equal(res.body.error.message, 'Email already registered');
    });

    it('rejects invalid email with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid-email-address', password: 'Password123!' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.details.some((d) => d.field === 'email'));
    });

    it('rejects password shorter than 8 characters with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'short@example.com', password: 'short' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.details.some((d) => d.field === 'password'));
    });

    it('rejects password exceeding 72 BYTES with 400', async () => {
      // 40 emoji characters: each emoji is 4 bytes = 160 bytes (well under 72 chars, but > 72 bytes)
      const emojiPassword = '🔐'.repeat(40);
      assert.equal(emojiPassword.length, 80); // 40 surrogate pairs
      assert.ok(Buffer.byteLength(emojiPassword, 'utf8') > 72);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'emoji@example.com', password: emojiPassword });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.details.some((d) => d.message.includes('72 bytes')));
    });

    it('rejects missing fields with 400 and detail issues', async () => {
      const res = await request(app).post('/api/auth/register').send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.details.length >= 2);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'user@mindlog.app', password: 'ValidPassword123' });
    });

    it('logs in successfully and sets mindlog_token cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@mindlog.app', password: 'ValidPassword123' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, 'user@mindlog.app');
      assert.ok(res.headers['set-cookie'][0].includes('mindlog_token='));
    });

    it('logs in with email in different letter case successfully', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'USER@MINDLOG.APP', password: 'ValidPassword123' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, 'user@mindlog.app');
    });

    it('returns 401 UNAUTHORIZED with generic message for incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@mindlog.app', password: 'WrongPassword999' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.equal(res.body.error.message, 'Invalid email or password');
    });

    it('returns identical 401 UNAUTHORIZED for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@mindlog.app', password: 'AnyPassword123' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.equal(res.body.error.message, 'Invalid email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user profile when authenticated with valid cookie', async () => {
      const agent = request.agent(app);

      // Register and establish session in agent
      await agent
        .post('/api/auth/register')
        .send({ email: 'session@mindlog.app', password: 'Password123!' });

      const res = await agent.get('/api/auth/me');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, 'session@mindlog.app');
      assert.equal(typeof res.body.data.user.id, 'string');
    });

    it('returns 401 when no cookie is sent', async () => {
      const res = await request(app).get('/api/auth/me');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.equal(res.body.error.message, 'Authentication required');
    });

    it('returns 401 and clears cookie when token is tampered', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'mindlog_token=invalid.tampered.jwttoken');

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');

      // Verify cookie is cleared on client
      const setCookie = res.headers['set-cookie'];
      assert.ok(setCookie);
      assert.ok(setCookie[0].includes('mindlog_token=;'));
    });

    it('returns 401 when token is signed with a different secret', async () => {
      const otherSecretToken = jwt.sign({ sub: new mongoose.Types.ObjectId().toString() }, 'different_secret_key_12345678901234567890');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `mindlog_token=${otherSecretToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('returns 401 when token is expired', async () => {
      const expiredToken = jwt.sign(
        { sub: new mongoose.Types.ObjectId().toString() },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: -10 } // Expired 10 seconds ago
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `mindlog_token=${expiredToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('returns 401 when token uses alg: none', async () => {
      // Construct unsigned token with alg: none
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: new mongoose.Types.ObjectId().toString() })).toString('base64url');
      const unsignedToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `mindlog_token=${unsignedToken}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('returns 401 and clears cookie if user was deleted from database', async () => {
      const agent = request.agent(app);

      const regRes = await agent
        .post('/api/auth/register')
        .send({ email: 'to_be_deleted@mindlog.app', password: 'Password123!' });

      const userId = regRes.body.data.user.id;

      // Delete user directly from DB
      await User.findByIdAndDelete(userId);

      const meRes = await agent.get('/api/auth/me');

      assert.equal(meRes.status, 401);
      assert.equal(meRes.body.error.code, 'UNAUTHORIZED');
      assert.ok(meRes.headers['set-cookie'][0].includes('mindlog_token=;'));
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the cookie and invalidates subsequent /me calls', async () => {
      const agent = request.agent(app);

      // 1. Sign up to get cookie
      await agent
        .post('/api/auth/register')
        .send({ email: 'logout_test@mindlog.app', password: 'Password123!' });

      // 2. Verify /me works
      const meBefore = await agent.get('/api/auth/me');
      assert.equal(meBefore.status, 200);

      // 3. Call logout
      const logoutRes = await agent.post('/api/auth/logout');
      assert.equal(logoutRes.status, 200);
      assert.equal(logoutRes.body.success, true);
      assert.equal(logoutRes.body.data.message, 'Logged out');

      // Verify clear-cookie header attributes match
      const cookieHeader = logoutRes.headers['set-cookie'][0];
      assert.ok(cookieHeader.includes('mindlog_token=;'));
      assert.ok(cookieHeader.includes('Path=/'));

      // 4. Verify /me now fails with 401 through the same agent
      const meAfter = await agent.get('/api/auth/me');
      assert.equal(meAfter.status, 401);
    });

    it('succeeds with 200 even if no cookie was sent (idempotent)', async () => {
      const res = await request(app).post('/api/auth/logout');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });
});

