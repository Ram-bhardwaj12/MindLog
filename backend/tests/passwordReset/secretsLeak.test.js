import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const mongod = await MongoMemoryServer.create();
const testMongoUri = mongod.getUri();

const FAKE_BREVO_KEY = 'xkeysib-SUPER_DISTINCTIVE_SECRET_KEY_NEVER_LEAK_987654321';
const FAKE_TOKEN = 'V3RY_DISTINCTIVE_T0KEN_STRING_43_CHARS_LONG_1';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = testMongoUri;
process.env.JWT_SECRET = 'test_jwt_secret_must_be_minimum_32_characters_long_for_security';
process.env.JWT_EXPIRES_DAYS = '7';
process.env.COOKIE_NAME = 'mindlog_token';
process.env.COOKIE_SAMESITE = 'lax';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.CLIENT_ORIGINS = 'http://localhost:5173';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.EMAIL_PROVIDER = 'brevo';
process.env.BREVO_API_KEY = FAKE_BREVO_KEY;
process.env.EMAIL_FROM_ADDRESS = 'noreply@mindlog.app';
process.env.EMAIL_FROM_NAME = 'MindLog';
process.env.PASSWORD_RESET_TTL_MINUTES = '30';

await mongoose.connect(testMongoUri);

const { default: app } = await import('../../src/app.js');
const { User } = await import('../../src/models/User.js');
const { PasswordResetToken } = await import('../../src/models/PasswordResetToken.js');

describe('Password Reset: Secrets Leak Prevention Tests', () => {
  let capturedLogs = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  before(() => {
    console.log = (...args) => {
      capturedLogs.push(args.join(' '));
    };
    console.warn = (...args) => {
      capturedLogs.push(args.join(' '));
    };
    console.error = (...args) => {
      capturedLogs.push(args.join(' '));
    };
  });

  after(async () => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    capturedLogs = [];
    await User.deleteMany({});
    await PasswordResetToken.deleteMany({});
  });

  it('distinctive fake BREVO_API_KEY and reset token never appear in response bodies, headers, or captured logs', async () => {
    const passwordHash = await bcrypt.hash('OriginalPassword123!', 4);
    await User.create({ email: 'secretcheck@mindlog.app', passwordHash });

    // Mock fetch to simulate an external Brevo API rejection with error details
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => `{"error":"Invalid credentials for key ${FAKE_BREVO_KEY}"}`,
    });

    try {
      // 1. Trigger forgot-password
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'secretcheck@mindlog.app' });

      assert.equal(forgotRes.status, 200);

      // Verify response body and headers
      const forgotResBody = JSON.stringify(forgotRes.body);
      const forgotResHeaders = JSON.stringify(forgotRes.headers);
      assert.ok(!forgotResBody.includes(FAKE_BREVO_KEY));
      assert.ok(!forgotResHeaders.includes(FAKE_BREVO_KEY));

      // Wait for background email dispatch
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify captured logs do not contain the fake API key
      const joinedLogs = capturedLogs.join('\n');
      assert.ok(!joinedLogs.includes(FAKE_BREVO_KEY));

      // 2. Trigger reset-password failure with fake token
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: FAKE_TOKEN, newPassword: 'BrandNewPassword123!' });

      assert.equal(resetRes.status, 400);

      const resetResBody = JSON.stringify(resetRes.body);
      const resetResHeaders = JSON.stringify(resetRes.headers);

      // Error response must NEVER echo back the supplied token
      assert.ok(!resetResBody.includes(FAKE_TOKEN));
      assert.ok(!resetResHeaders.includes(FAKE_TOKEN));
      assert.ok(!resetResBody.includes(FAKE_BREVO_KEY));

      // Verify logs still do not contain either secret
      const finalLogs = capturedLogs.join('\n');
      assert.ok(!finalLogs.includes(FAKE_BREVO_KEY));
      assert.ok(!finalLogs.includes(FAKE_TOKEN));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
