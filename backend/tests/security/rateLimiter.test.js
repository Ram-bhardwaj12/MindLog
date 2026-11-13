import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// 1. Initialize MongoMemoryServer
const mongod = await MongoMemoryServer.create();
const testMongoUri = mongod.getUri();

// 2. Set test environment
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = testMongoUri;
process.env.JWT_SECRET = 'test_jwt_secret_must_be_minimum_32_characters_long_for_security';
process.env.JWT_EXPIRES_DAYS = '7';
process.env.COOKIE_NAME = 'mindlog_token';
process.env.COOKIE_SAMESITE = 'lax';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.CLIENT_ORIGINS = 'http://localhost:5173';

await mongoose.connect(testMongoUri);

const { User } = await import('../../src/models/User.js');
const { Entry } = await import('../../src/models/Entry.js');
const { createAuthRouter } = await import('../../src/routes/auth.routes.js');
const { createEntryRouter } = await import('../../src/routes/entry.routes.js');
const { signAuthToken } = await import('../../src/utils/token.js');
const {
  createGeneralApiLimiter,
  createEmailLoginLimiter,
  createEntryWriteLimiter,
  createMediaUploadLimiter,
} = await import('../../src/middleware/rateLimiter.js');

describe('Security Hardening: Rate Limiting Unit & Integration Tests', () => {
  before(async () => {
    await User.init();
    await Entry.init();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Entry.deleteMany({});
  });

  describe('General API Rate Limiter (createGeneralApiLimiter)', () => {
    it('enforces limit on /api routes, sets Retry-After and draft-7 headers, and skips /api/health', async () => {
      const app = express();
      const tightLimiter = createGeneralApiLimiter({
        windowMs: 60000,
        max: 2,
        message: 'General API limit exceeded',
      });

      app.use(tightLimiter);
      app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
      app.get('/api/test', (req, res) => res.json({ message: 'allowed' }));

      // Requests 1 & 2 succeed
      const r1 = await request(app).get('/api/test');
      assert.equal(r1.status, 200);

      const r2 = await request(app).get('/api/test');
      assert.equal(r2.status, 200);

      // Request 3 exceeds limit
      const r3 = await request(app).get('/api/test');
      assert.equal(r3.status, 429);
      assert.equal(r3.body.error.code, 'TOO_MANY_REQUESTS');
      assert.equal(r3.body.error.message, 'General API limit exceeded');
      assert.ok(r3.headers['retry-after'], 'Retry-After header must be set');
      assert.ok(r3.headers['ratelimit-policy'] || r3.headers['ratelimit'], 'Standard draft-7 RateLimit header present');

      // Crucial: /api/health is skipped and remains accessible
      const healthRes = await request(app).get('/api/health');
      assert.equal(healthRes.status, 200);
      assert.equal(healthRes.body.status, 'ok');
    });
  });

  describe('Per-Email Login Rate Limiter (createEmailLoginLimiter)', () => {
    it('throttles repeated login attempts per email, keyed by SHA-256, without revealing account existence', async () => {
      const validEmail = 'target@mindlog.app';
      const password = 'Password123!';
      const salt = await (await import('bcrypt')).default.genSalt(4);
      const hash = await (await import('bcrypt')).default.hash(password, salt);
      await User.create({ email: validEmail, passwordHash: hash });

      const tightEmailLimiter = createEmailLoginLimiter({
        windowMs: 60000,
        max: 2,
        message: 'Too many login attempts for this account',
      });

      const app = express();
      app.use(express.json());
      app.use(
        '/api/auth',
        createAuthRouter({
          emailLimiter: tightEmailLimiter,
        })
      );

      // Attempt 1 for target account: wrong password -> 401
      const a1 = await request(app).post('/api/auth/login').send({
        email: 'TARGET@mindlog.app', // Test case-insensitivity
        password: 'WrongPassword1',
      });
      assert.equal(a1.status, 401);

      // Attempt 2 for target account: wrong password -> 401
      const a2 = await request(app).post('/api/auth/login').send({
        email: 'target@mindlog.app ', // Test whitespace trimming
        password: 'WrongPassword2',
      });
      assert.equal(a2.status, 401);

      // Attempt 3 for target account: throttled -> 429
      const a3 = await request(app).post('/api/auth/login').send({
        email: 'target@mindlog.app',
        password: 'Password123!',
      });
      assert.equal(a3.status, 429);
      assert.equal(a3.body.error.code, 'TOO_MANY_REQUESTS');
      assert.equal(a3.body.error.message, 'Too many login attempts for this account');

      // Crucial defense: Different email account is NOT affected by target account's limiter
      const diffAccount = await request(app).post('/api/auth/login').send({
        email: 'unrelated@mindlog.app',
        password: 'AnyPassword',
      });
      assert.equal(diffAccount.status, 401); // Reaches auth logic, not 429
    });

    it('returns identical 429 response for a non-existent email account (zero enumeration leakage)', async () => {
      const tightEmailLimiter = createEmailLoginLimiter({
        windowMs: 60000,
        max: 2,
        message: 'Too many login attempts for this account',
      });

      const app = express();
      app.use(express.json());
      app.use(
        '/api/auth',
        createAuthRouter({
          emailLimiter: tightEmailLimiter,
        })
      );

      const fakeEmail = 'ghost@nowhere.test';
      await request(app).post('/api/auth/login').send({ email: fakeEmail, password: 'p1' });
      await request(app).post('/api/auth/login').send({ email: fakeEmail, password: 'p2' });

      const a3 = await request(app).post('/api/auth/login').send({ email: fakeEmail, password: 'p3' });
      assert.equal(a3.status, 429);
      assert.equal(a3.body.error.code, 'TOO_MANY_REQUESTS');
    });
  });

  describe('Per-User Entry Write Limiter (createEntryWriteLimiter)', () => {
    it('throttles mutating entry operations keyed by authenticated user ID, without affecting other users', async () => {
      const u1 = await User.create({ email: 'user1@test.com', passwordHash: 'hash1' });
      const u2 = await User.create({ email: 'user2@test.com', passwordHash: 'hash2' });

      const cookieUser1 = `mindlog_token=${signAuthToken(u1._id.toString())}`;
      const cookieUser2 = `mindlog_token=${signAuthToken(u2._id.toString())}`;

      const tightWriteLimiter = createEntryWriteLimiter({
        windowMs: 60000,
        max: 2,
        message: 'Entry write limit exceeded',
      });

      const app = express();
      app.use(cookieParser());
      app.use(express.json());

      app.use('/api/entries', createEntryRouter({ writeLimiter: tightWriteLimiter }));

      // User 1 performs 2 writes
      const w1 = await request(app)
        .post('/api/entries')
        .set('Cookie', cookieUser1)
        .send({ title: 'Entry 1' });
      assert.equal(w1.status, 201);

      const w2 = await request(app)
        .post('/api/entries')
        .set('Cookie', cookieUser1)
        .send({ title: 'Entry 2' });
      assert.equal(w2.status, 201);

      // User 1 attempt 3: rate limited
      const w3 = await request(app)
        .post('/api/entries')
        .set('Cookie', cookieUser1)
        .send({ title: 'Entry 3' });
      assert.equal(w3.status, 429);
      assert.equal(w3.body.error.code, 'TOO_MANY_REQUESTS');

      // User 1 read operations are NOT blocked by write limiter
      const listRes = await request(app)
        .get('/api/entries')
        .set('Cookie', cookieUser1);
      assert.equal(listRes.status, 200);

      // User 2 writes are NOT throttled by User 1's bucket
      const user2Write = await request(app)
        .post('/api/entries')
        .set('Cookie', cookieUser2)
        .send({ title: 'User 2 Entry' });
      assert.equal(user2Write.status, 201);
    });
  });

  describe('Per-User Media Upload Limiter (createMediaUploadLimiter)', () => {
    it('is mounted BEFORE Multer file streaming so rate-limited uploads write 0 bytes to disk', async () => {
      const u = await User.create({ email: 'uploader@test.com', passwordHash: 'hash' });
      const entry = await Entry.create({ userId: u._id, title: 'Upload Entry' });

      let diskWriteAttempted = false;

      // Mock Multer uploadMiddleware to monitor if it ever gets called
      const mockMulterMiddleware = (req, res, next) => {
        diskWriteAttempted = true;
        next();
      };

      const tightUploadLimiter = createMediaUploadLimiter({
        windowMs: 60000,
        max: 1,
        message: 'Upload limit exceeded',
      });

      const app = express();
      app.use((req, res, next) => {
        req.user = u;
        next();
      });

      // Simulate route middleware chain: requireAuth -> loadOwnedActiveEntry -> uploadLimiter -> Multer
      app.post(
        '/api/entries/:id/media',
        (req, res, next) => {
          req.entry = entry;
          next();
        },
        tightUploadLimiter,
        mockMulterMiddleware,
        (req, res) => res.status(201).json({ success: true })
      );

      // Upload 1: succeeds and calls Multer
      const r1 = await request(app).post(`/api/entries/${entry._id}/media`);
      assert.equal(r1.status, 201);
      assert.equal(diskWriteAttempted, true);

      // Reset spy flag
      diskWriteAttempted = false;

      // Upload 2: blocked by uploadLimiter BEFORE Multer
      const r2 = await request(app).post(`/api/entries/${entry._id}/media`);
      assert.equal(r2.status, 429);
      assert.equal(r2.body.error.code, 'TOO_MANY_REQUESTS');
      assert.equal(diskWriteAttempted, false, 'Multer file streaming must NOT be invoked when rate limited');
    });
  });
});
