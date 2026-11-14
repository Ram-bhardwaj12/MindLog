import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
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

const { default: app } = await import('../../src/app.js');
const { User } = await import('../../src/models/User.js');
const { Entry } = await import('../../src/models/Entry.js');
const { signAuthToken } = await import('../../src/utils/token.js');

describe('Security Hardening: NoSQL Operator Key Defense Tests (Phase 8 A3)', () => {
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

  it('rejects login with {"email": {"$ne": null}, "password": {"$ne": null}} with 400 BAD_REQUEST and executes zero DB queries', async () => {
    // Seed one user into database
    await User.create({ email: 'victim@mindlog.app', passwordHash: 'some_hash' });

    // Spy on User.findOne to prove no query is executed
    let queryExecuted = false;
    const originalFindOne = User.findOne;
    User.findOne = function (...args) {
      queryExecuted = true;
      return originalFindOne.apply(this, args);
    };

    try {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: { $ne: null },
          password: { $ne: null },
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'BAD_REQUEST');
      assert.equal(res.body.error.message, 'Invalid request');
      assert.equal(queryExecuted, false, 'Database query must NOT be executed for operator-injected payload');
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('rejects query parameter operator injection GET /api/entries?includeTrash[$ne]=x with 400 BAD_REQUEST', async () => {
    const user = await User.create({ email: 'querytest@mindlog.app', passwordHash: 'hash' });
    const authCookie = `mindlog_token=${signAuthToken(user._id.toString())}`;

    const res = await request(app)
      .get('/api/entries?includeTrash[$ne]=true')
      .set('Cookie', authCookie);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'BAD_REQUEST');
    assert.equal(res.body.error.message, 'Invalid request');
  });

  it('rejects entry create with a $-operator key in the body with 400 BAD_REQUEST', async () => {
    const user = await User.create({ email: 'createtest@mindlog.app', passwordHash: 'hash' });
    const authCookie = `mindlog_token=${signAuthToken(user._id.toString())}`;

    const res = await request(app)
      .post('/api/entries')
      .set('Cookie', authCookie)
      .send({
        title: 'Valid Title',
        $where: 'sleep(5000)',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'BAD_REQUEST');
    assert.equal(res.body.error.message, 'Invalid request');
  });

  it('rejects entry create with a dot (.) key in body (path traversal / prototype pollution) with 400 BAD_REQUEST', async () => {
    const user = await User.create({ email: 'dottest@mindlog.app', passwordHash: 'hash' });
    const authCookie = `mindlog_token=${signAuthToken(user._id.toString())}`;

    const res = await request(app)
      .post('/api/entries')
      .set('Cookie', authCookie)
      .send({
        title: 'Dot key test',
        'media.0.url': 'http://evil.com/override',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'BAD_REQUEST');
    assert.equal(res.body.error.message, 'Invalid request');
  });

  it('allows normal title containing a dollar sign ($) or dot (.) in the VALUE', async () => {
    const user = await User.create({ email: 'valuestest@mindlog.app', passwordHash: 'hash' });
    const authCookie = `mindlog_token=${signAuthToken(user._id.toString())}`;

    const res = await request(app)
      .post('/api/entries')
      .set('Cookie', authCookie)
      .send({
        title: 'Version 2.0 release: Stock rose by $50 per share.',
        bodyHtml: '<p>Legitimate content with $100 and dot.com references.</p>',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.entry.title, 'Version 2.0 release: Stock rose by $50 per share.');
  });
});

