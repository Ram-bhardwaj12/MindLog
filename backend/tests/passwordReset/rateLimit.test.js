import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
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

const { User } = await import('../../src/models/User.js');
const { PasswordResetToken } = await import('../../src/models/PasswordResetToken.js');
const { createAuthRouter } = await import('../../src/routes/auth.routes.js');
const {
  createForgotPasswordRateLimiter,
  createForgotPasswordEmailLimiter,
  createResetPasswordRateLimiter,
} = await import('../../src/middleware/rateLimiter.js');

function buildTestApp({ forgotLimiter, forgotEmailLimiter, resetLimiter }) {
  const app = express();
  app.use(express.json());
  const router = createAuthRouter({
    forgotLimiter,
    forgotEmailLimiter,
    resetLimiter,
  });
  app.use('/api/auth', router);
  return app;
}

describe('Password Reset: Rate Limiting Tests', () => {
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

  it('throttles forgot-password by IP with standard 429 envelope', async () => {
    const tightIpLimiter = createForgotPasswordRateLimiter({
      windowMs: 60000,
      max: 2,
      message: 'Too many password reset requests from this IP for test',
    });

    const testApp = buildTestApp({ forgotLimiter: tightIpLimiter });

    // Request 1: allowed
    const res1 = await request(testApp)
      .post('/api/auth/forgot-password')
      .send({ email: 'first@mindlog.app' });
    assert.equal(res1.status, 200);

    // Request 2: allowed
    const res2 = await request(testApp)
      .post('/api/auth/forgot-password')
      .send({ email: 'second@mindlog.app' });
    assert.equal(res2.status, 200);

    // Request 3: blocked by IP limiter -> 429
    const res3 = await request(testApp)
      .post('/api/auth/forgot-password')
      .send({ email: 'third@mindlog.app' });
    assert.equal(res3.status, 429);
    assert.equal(res3.body.success, false);
    assert.equal(res3.body.error.code, 'TOO_MANY_REQUESTS');
    assert.equal(
      res3.body.error.message,
      'Too many password reset requests from this IP for test'
    );
    assert.deepEqual(res3.body.error.details, []);
    assert.ok(res3.headers['retry-after']);
  });

  it('throttles forgot-password by email and behaves identically for unknown emails', async () => {
    await User.create({ email: 'registered@mindlog.app', passwordHash: 'hash123' });

    const tightEmailLimiterKnown = createForgotPasswordEmailLimiter({
      windowMs: 60000,
      max: 2,
      message: 'Too many password reset requests for this email account',
    });
    const appKnown = buildTestApp({ forgotEmailLimiter: tightEmailLimiterKnown });

    // Request 1 & 2 for known email: allowed
    await request(appKnown).post('/api/auth/forgot-password').send({ email: 'registered@mindlog.app' });
    await request(appKnown).post('/api/auth/forgot-password').send({ email: 'registered@mindlog.app' });

    // Request 3: blocked -> 429
    const resKnown429 = await request(appKnown)
      .post('/api/auth/forgot-password')
      .send({ email: 'registered@mindlog.app' });

    assert.equal(resKnown429.status, 429);
    assert.equal(resKnown429.body.success, false);
    assert.equal(resKnown429.body.error.code, 'TOO_MANY_REQUESTS');

    // Now test with non-existent email
    const tightEmailLimiterUnknown = createForgotPasswordEmailLimiter({
      windowMs: 60000,
      max: 2,
      message: 'Too many password reset requests for this email account',
    });
    const appUnknown = buildTestApp({ forgotEmailLimiter: tightEmailLimiterUnknown });

    // Request 1 & 2 for unknown email: allowed
    await request(appUnknown).post('/api/auth/forgot-password').send({ email: 'ghost@mindlog.app' });
    await request(appUnknown).post('/api/auth/forgot-password').send({ email: 'ghost@mindlog.app' });

    // Request 3: blocked -> 429
    const resUnknown429 = await request(appUnknown)
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@mindlog.app' });

    assert.equal(resUnknown429.status, 429);
    assert.deepEqual(resUnknown429.body, resKnown429.body);
  });

  it('throttles reset-password by IP with standard 429 envelope', async () => {
    const tightResetLimiter = createResetPasswordRateLimiter({
      windowMs: 60000,
      max: 2,
      message: 'Too many reset attempts from this IP for test',
    });

    const testApp = buildTestApp({ resetLimiter: tightResetLimiter });

    // Request 1: allowed (validation error 400, but rate limiter counts it)
    const res1 = await request(testApp).post('/api/auth/reset-password').send({});
    assert.equal(res1.status, 400);

    // Request 2: allowed
    const res2 = await request(testApp).post('/api/auth/reset-password').send({});
    assert.equal(res2.status, 400);

    // Request 3: blocked -> 429
    const res3 = await request(testApp).post('/api/auth/reset-password').send({});
    assert.equal(res3.status, 429);
    assert.equal(res3.body.success, false);
    assert.equal(res3.body.error.code, 'TOO_MANY_REQUESTS');
    assert.equal(res3.body.error.message, 'Too many reset attempts from this IP for test');
  });
});
