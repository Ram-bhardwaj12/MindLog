import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Set test environment before loading application configuration
process.env.NODE_ENV = 'test';
process.env.CLIENT_ORIGINS = 'http://localhost:5173';

const { default: app } = await import('../src/app.js');

describe('Health and System Middleware Smoke Tests', () => {
  it('GET /api/health returns 200 with standard success envelope', async () => {
    const res = await request(app).get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data, 'object');
    assert.equal(res.body.data.status, 'ok');
    assert.equal(res.body.data.database, 'disconnected');
    assert.ok(res.body.data.timestamp);
    assert.equal(typeof res.body.data.uptimeSeconds, 'number');
  });

  it('GET /api/does-not-exist returns 404 with standard error envelope and NOT_FOUND code', async () => {
    const res = await request(app).get('/api/does-not-exist');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(typeof res.body.error, 'object');
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.ok(res.body.error.message.includes('/api/does-not-exist'));
    assert.deepEqual(res.body.error.details, []);
  });

  it('CORS: allowed origin receives credentials header and echoed origin header', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  it('CORS: disallowed origin does not receive Access-Control-Allow-Origin header', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://malicious-site.example.com');

    assert.notEqual(res.headers['access-control-allow-origin'], 'http://malicious-site.example.com');
  });
});

