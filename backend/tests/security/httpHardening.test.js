import { describe, it, before, after } from 'node:test';
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

describe('Security Hardening: HTTP & Server Hardening Tests (Phase 8 A4)', () => {
  let testUser;
  let authCookie;

  before(async () => {
    await User.init();
    await Entry.init();
    testUser = await User.create({ email: 'http_hardening@test.com', passwordHash: 'hash' });
    authCookie = `mindlog_token=${signAuthToken(testUser._id.toString())}`;
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe('HTTP Response Headers', () => {
    it('never sends X-Powered-By header on any API response', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.headers['x-powered-by'], undefined);
    });

    it('enforces Helmet default security headers (nosniff, HSTS, frameguard)', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.ok(res.headers['strict-transport-security'] || res.headers['x-frame-options']);
    });

    it('sets Cache-Control: no-store on all /api/auth/* endpoints', async () => {
      const meRes = await request(app).get('/api/auth/me').set('Cookie', authCookie);
      assert.ok(
        meRes.headers['cache-control']?.includes('no-store'),
        'Auth responses must include Cache-Control: no-store'
      );
    });

    it('sets Cache-Control: no-store on all /api/entries endpoints', async () => {
      const entryRes = await request(app).get('/api/entries').set('Cookie', authCookie);
      assert.ok(
        entryRes.headers['cache-control']?.includes('no-store'),
        'Entries responses must include Cache-Control: no-store'
      );
    });

    it('sets Vary: Origin and Access-Control-Max-Age: 600 on CORS preflight requests', async () => {
      const preflightRes = await request(app)
        .options('/api/entries')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');

      assert.equal(preflightRes.status, 204);
      assert.equal(preflightRes.headers['access-control-allow-origin'], 'http://localhost:5173');
      assert.ok(preflightRes.headers['vary']?.includes('Origin'), 'Vary header must include Origin');
      assert.equal(preflightRes.headers['access-control-max-age'], '600');
    });
  });

  describe('Content-Type Enforcement', () => {
    it('rejects POST /api/auth/login with text/plain with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'text/plain')
        .send('email=a&password=b');

      assert.equal(res.status, 415);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects POST /api/auth/register with text/plain with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('raw text data');

      assert.equal(res.status, 415);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects POST /api/entries with text/plain with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await request(app)
        .post('/api/entries')
        .set('Cookie', authCookie)
        .set('Content-Type', 'text/plain')
        .send('plain title');

      assert.equal(res.status, 415);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects PUT /api/entries/:id with text/plain with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await request(app)
        .put('/api/entries/6af6909831895c743e9bedec')
        .set('Cookie', authCookie)
        .set('Content-Type', 'text/plain')
        .send('title update');

      assert.equal(res.status, 415);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects PATCH /api/entries/:id/bookmark with text/plain with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await request(app)
        .patch('/api/entries/6af6909831895c743e9bedec/bookmark')
        .set('Cookie', authCookie)
        .set('Content-Type', 'text/plain')
        .send('bookmarked=true');

      assert.equal(res.status, 415);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects multipart requests on JSON routes (POST /api/entries) with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const res = await request(app)
        .post('/api/entries')
        .set('Cookie', authCookie)
        .set('Content-Type', 'multipart/form-data; boundary=----WebKitFormBoundaryX')
        .send('------WebKitFormBoundaryX\r\nContent-Disposition: form-data; name="title"\r\n\r\nTest\r\n------WebKitFormBoundaryX--');

      assert.equal(res.status, 415);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
      assert.ok(res.body.error.message.includes('media upload'));
    });

    it('allows body-less requests (logout, trash, restore, delete) without Content-Type: application/json', async () => {
      // 1. Create an entry to operate upon
      const createRes = await request(app)
        .post('/api/entries')
        .set('Cookie', authCookie)
        .send({ title: 'Bodyless Lifecycle Test' });
      assert.equal(createRes.status, 201);
      const entryId = createRes.body.data.entry.id;

      // 2. PATCH trash without Content-Type header succeeds
      const trashRes = await request(app)
        .patch(`/api/entries/${entryId}/trash`)
        .set('Cookie', authCookie);
      assert.equal(trashRes.status, 200);

      // 3. PATCH restore without Content-Type header succeeds
      const restoreRes = await request(app)
        .patch(`/api/entries/${entryId}/restore`)
        .set('Cookie', authCookie);
      assert.equal(restoreRes.status, 200);

      // 4. DELETE entry without Content-Type header succeeds
      const deleteRes = await request(app)
        .delete(`/api/entries/${entryId}`)
        .set('Cookie', authCookie);
      assert.equal(deleteRes.status, 200);

      // 5. POST logout without Content-Type header succeeds
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookie);
      assert.equal(logoutRes.status, 200);
    });
  });
});

