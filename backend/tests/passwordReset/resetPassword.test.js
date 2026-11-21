import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

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
const { generateResetToken, hashResetToken } = await import('../../src/utils/resetToken.js');

describe('Password Reset: Reset Password Tests (POST /api/auth/reset-password)', () => {
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

  it('success changes password (old fails, new works), clears cookie, returns 200 without login', async () => {
    const initialHash = await bcrypt.hash('OldPassword123!', 4);
    const user = await User.create({ email: 'user@mindlog.app', passwordHash: initialHash });

    const { token, tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token,
        newPassword: 'NewPassword456!',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, { message: 'Password updated. Please sign in.' });

    // Verify response does not auto-login (no user profile, cleared cookie)
    assert.equal(res.body.data.user, undefined);
    assert.equal(res.body.data.token, undefined);

    const cookies = res.headers['set-cookie'];
    assert.ok(cookies, 'Expected set-cookie header clearing auth cookie');
    const cookieHeader = cookies[0];
    assert.ok(
      cookieHeader.includes('mindlog_token=;') ||
        cookieHeader.includes('Expires=Thu, 01 Jan 1970') ||
        cookieHeader.includes('Max-Age=0')
    );

    // Old password fails to log in
    const loginOld = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@mindlog.app', password: 'OldPassword123!' });
    assert.equal(loginOld.status, 401);

    // New password logs in successfully
    const loginNew = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@mindlog.app', password: 'NewPassword456!' });
    assert.equal(loginNew.status, 200);
    assert.equal(loginNew.body.success, true);
  });

  it('reusing the same token gives 400 INVALID_RESET_TOKEN', async () => {
    const hash = await bcrypt.hash('InitialPass123!', 4);
    const user = await User.create({ email: 'user@mindlog.app', passwordHash: hash });

    const { token, tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });

    // First use: succeeds
    const firstRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'FirstNewPassword123!' });
    assert.equal(firstRes.status, 200);

    // Second use: fails with INVALID_RESET_TOKEN
    const secondRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'SecondNewPassword123!' });
    assert.equal(secondRes.status, 400);
    assert.equal(secondRes.body.success, false);
    assert.equal(secondRes.body.error.code, 'INVALID_RESET_TOKEN');
    assert.equal(secondRes.body.error.message, 'Invalid or expired reset link');
  });

  it('an expired token (expiresAt in the past) gives 400 INVALID_RESET_TOKEN', async () => {
    const hash = await bcrypt.hash('InitialPass123!', 4);
    const user = await User.create({ email: 'user@mindlog.app', passwordHash: hash });

    const { token, tokenHash } = generateResetToken();
    // 5 minutes in the past
    const expiresAt = new Date(Date.now() - 5 * 60 * 1000);
    await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'ValidNewPassword123!' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_RESET_TOKEN');
    assert.equal(res.body.error.message, 'Invalid or expired reset link');
  });

  it('a malformed token gives 400 INVALID_RESET_TOKEN', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'short_token',
        newPassword: 'ValidNewPassword123!',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_RESET_TOKEN');
  });

  it('password under 8 characters and over 72 bytes give 400 VALIDATION_ERROR', async () => {
    const { token } = generateResetToken();

    // Under 8 characters
    const resShort = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'short' });
    assert.equal(resShort.status, 400);
    assert.equal(resShort.body.error.code, 'VALIDATION_ERROR');

    // Over 72 bytes
    const longPassword = 'a'.repeat(73);
    const resLong = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: longPassword });
    assert.equal(resLong.status, 400);
    assert.equal(resLong.body.error.code, 'VALIDATION_ERROR');
  });

  it('a token for a deleted user gives 400 INVALID_RESET_TOKEN', async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId();
    const { token, tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await PasswordResetToken.create({
      userId: nonExistentUserId,
      tokenHash,
      expiresAt,
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'ValidNewPassword123!' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_RESET_TOKEN');
  });

  it('after success every other reset token of that user is gone', async () => {
    const hash = await bcrypt.hash('InitialPass123!', 4);
    const user = await User.create({ email: 'multi@mindlog.app', passwordHash: hash });

    // Create 3 active tokens for this user
    const token1 = generateResetToken();
    const token2 = generateResetToken();
    const token3 = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await PasswordResetToken.create([
      { userId: user._id, tokenHash: token1.tokenHash, expiresAt },
      { userId: user._id, tokenHash: token2.tokenHash, expiresAt },
      { userId: user._id, tokenHash: token3.tokenHash, expiresAt },
    ]);

    // Reset password using token2
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: token2.token, newPassword: 'BrandNewPassword123!' });

    assert.equal(res.status, 200);

    // Verify 0 tokens remain for this user
    const remaining = await PasswordResetToken.find({ userId: user._id });
    assert.equal(remaining.length, 0);
  });
});
