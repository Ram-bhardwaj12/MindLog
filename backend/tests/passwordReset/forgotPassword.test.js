import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

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
const { emailClient } = await import('../../src/services/email/index.js');

const flushBackgroundTasks = () => new Promise((resolve) => setTimeout(resolve, 40));

describe('Password Reset: Forgot Password Tests (POST /api/auth/forgot-password)', () => {
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
    mock.reset();
  });

  it('existing and unknown emails get an IDENTICAL 200 response (status and body)', async () => {
    await User.create({ email: 'registered@mindlog.app', passwordHash: 'hash123' });

    const emailSendMock = mock.method(emailClient, 'sendPasswordResetEmail', async () => {});

    // 1. Request for registered user
    const resKnown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'registered@mindlog.app' });

    // 2. Request for non-existent user
    const resUnknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@mindlog.app' });

    await flushBackgroundTasks();

    // Verify identical HTTP status
    assert.equal(resKnown.status, 200);
    assert.equal(resUnknown.status, 200);

    // Verify identical body structure and message
    assert.deepEqual(resKnown.body, {
      success: true,
      data: {
        message: 'If an account exists for that email, a reset link has been sent.',
      },
    });
    assert.deepEqual(resUnknown.body, resKnown.body);

    // Verify mock invocation: called once for registered user, 0 for unknown
    assert.equal(emailSendMock.mock.callCount(), 1);
  });

  it('rejects invalid email formats with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.some((d) => d.field === 'email'));
  });

  it('stores a 64-character hex tokenHash and ensures plain token is NOT in database', async () => {
    const user = await User.create({ email: 'author@mindlog.app', passwordHash: 'hash123' });

    let capturedResetUrl = '';
    mock.method(emailClient, 'sendPasswordResetEmail', async ({ resetUrl }) => {
      capturedResetUrl = resetUrl;
    });

    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'author@mindlog.app' });

    await flushBackgroundTasks();

    // Verify URL passed to emailClient uses FRONTEND_URL
    assert.ok(capturedResetUrl.startsWith('http://localhost:5173/reset-password?token='));
    const urlObj = new URL(capturedResetUrl);
    const plainToken = urlObj.searchParams.get('token');
    assert.ok(plainToken);
    assert.equal(plainToken.length, 43);

    // Verify database record
    const tokenDoc = await PasswordResetToken.findOne({ userId: user._id });
    assert.ok(tokenDoc);
    assert.equal(typeof tokenDoc.tokenHash, 'string');
    assert.equal(tokenDoc.tokenHash.length, 64);
    assert.match(tokenDoc.tokenHash, /^[0-9a-f]{64}$/);

    // Plain token must never be stored anywhere in the document
    assert.notEqual(tokenDoc.tokenHash, plainToken);
    assert.equal(tokenDoc.token, undefined);
  });

  it('replaces previous token on second request (first token becomes invalid)', async () => {
    const user = await User.create({ email: 'author@mindlog.app', passwordHash: 'hash123' });

    const capturedTokens = [];
    mock.method(emailClient, 'sendPasswordResetEmail', async ({ resetUrl }) => {
      const url = new URL(resetUrl);
      capturedTokens.push(url.searchParams.get('token'));
    });

    // First request
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'author@mindlog.app' });
    await flushBackgroundTasks();

    // Second request
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'author@mindlog.app' });
    await flushBackgroundTasks();

    assert.equal(capturedTokens.length, 2);
    assert.notEqual(capturedTokens[0], capturedTokens[1]);

    // Database should hold exactly one token for this user
    const tokens = await PasswordResetToken.find({ userId: user._id });
    assert.equal(tokens.length, 1);
  });

  it('email-provider failure still gives 200 and does not crash the server', async () => {
    await User.create({ email: 'author@mindlog.app', passwordHash: 'hash123' });

    mock.method(emailClient, 'sendPasswordResetEmail', async () => {
      throw new Error('Network failure connecting to email gateway');
    });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'author@mindlog.app' });

    await flushBackgroundTasks();

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(
      res.body.data.message,
      'If an account exists for that email, a reset link has been sent.'
    );
  });
});
