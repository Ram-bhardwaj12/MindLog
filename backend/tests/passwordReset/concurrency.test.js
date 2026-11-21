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
const { generateResetToken } = await import('../../src/utils/resetToken.js');

describe('Password Reset: Concurrency Tests', () => {
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

  it('two simultaneous reset-password calls with the same token: exactly one succeeds', async () => {
    const passwordHash = await bcrypt.hash('InitialPass123!', 4);
    const user = await User.create({ email: 'concurrent@mindlog.app', passwordHash });

    const { token, tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });

    // Send two concurrent reset-password requests in parallel
    const [res1, res2] = await Promise.all([
      request(app).post('/api/auth/reset-password').send({ token, newPassword: 'FirstWinnerPassword123!' }),
      request(app).post('/api/auth/reset-password').send({ token, newPassword: 'SecondWinnerPassword123!' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [200, 400], 'Expected exactly one 200 and one 400');

    const winner = res1.status === 200 ? res1 : res2;
    const loser = res1.status === 400 ? res1 : res2;

    assert.equal(winner.body.success, true);
    assert.equal(winner.body.data.message, 'Password updated. Please sign in.');

    assert.equal(loser.body.success, false);
    assert.equal(loser.body.error.code, 'INVALID_RESET_TOKEN');
    assert.equal(loser.body.error.message, 'Invalid or expired reset link');
  });
});
