import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const mongod = await MongoMemoryServer.create();
const testMongoUri = mongod.getUri();

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = testMongoUri;
process.env.JWT_SECRET = 'test_jwt_secret_must_be_minimum_32_characters_long_for_security';
process.env.JWT_EXPIRES_DAYS = '7';
process.env.COOKIE_NAME = 'mindlog_token';
process.env.COOKIE_SAMESITE = 'lax';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.CLIENT_ORIGINS = 'http://localhost:5173';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.EMAIL_PROVIDER = 'console';
process.env.PASSWORD_RESET_TTL_MINUTES = '30';

await mongoose.connect(testMongoUri);

const { default: app } = await import('../../src/app.js');
const { User } = await import('../../src/models/User.js');
const { PasswordResetToken } = await import('../../src/models/PasswordResetToken.js');
const { generateResetToken } = await import('../../src/utils/resetToken.js');

describe('Password Reset: Session Invalidation Tests', () => {
  before(async () => {
    await User.init();
    await PasswordResetToken.init();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await PasswordResetToken.deleteMany({});
  });

  it('invalidates existing session tokens issued before the password reset', async () => {
    const passwordHash = await bcrypt.hash('OriginalPass123!', 4);
    const user = await User.create({ email: 'session@mindlog.app', passwordHash });

    // 1. Forge a valid session token issued 10 seconds ago
    const issuedAt = Math.floor(Date.now() / 1000) - 10;
    const oldSessionToken = jwt.sign(
      { sub: user._id.toString(), iat: issuedAt },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: 7 * 24 * 3600 }
    );

    // Verify the old session token works initially before any password reset
    const preCheck = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`mindlog_token=${oldSessionToken}`]);
    assert.equal(preCheck.status, 200);
    assert.equal(preCheck.body.data.user.email, 'session@mindlog.app');

    // 2. Perform password reset
    const { token, tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'UpdatedSecurePass123!' });
    assert.equal(resetRes.status, 200);

    // 3. Request /api/auth/me using the old session cookie -> MUST return 401 and clear cookie
    const postResetOldSession = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`mindlog_token=${oldSessionToken}`]);

    assert.equal(postResetOldSession.status, 401);
    assert.equal(postResetOldSession.body.success, false);
    assert.equal(postResetOldSession.body.error.code, 'UNAUTHORIZED');
    assert.equal(postResetOldSession.body.error.message, 'Authentication required');

    const clearCookies = postResetOldSession.headers['set-cookie'];
    assert.ok(clearCookies, 'Expected cookie clearing header on 401');

    // 4. Fresh login with new password succeeds and its new session token works
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'session@mindlog.app', password: 'UpdatedSecurePass123!' });

    assert.equal(loginRes.status, 200);
    const freshCookie = loginRes.headers['set-cookie'];
    assert.ok(freshCookie);

    const postResetNewSession = await request(app)
      .get('/api/auth/me')
      .set('Cookie', freshCookie);

    assert.equal(postResetNewSession.status, 200);
    assert.equal(postResetNewSession.body.data.user.email, 'session@mindlog.app');
  });
});
