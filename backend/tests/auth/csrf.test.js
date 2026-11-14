import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Ensure test environment
process.env.NODE_ENV = 'test';
process.env.CLIENT_ORIGINS = 'http://localhost:5173';

const { default: app } = await import('../../src/app.js');

describe('CSRF and Origin Protection Tests', () => {
  const disallowedOrigin = 'http://malicious-attacker.com';

  it('rejects POST with disallowed Origin with 403 FORBIDDEN and halts execution', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', disallowedOrigin)
      .send({ email: 'test@example.com', password: 'password123' });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
    assert.equal(res.body.error.message, 'Origin is not permitted by CORS policy');
  });

  it('rejects PUT requests with disallowed Origin', async () => {
    const res = await request(app)
      .put('/api/health')
      .set('Origin', disallowedOrigin);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('rejects PATCH requests with disallowed Origin', async () => {
    const res = await request(app)
      .patch('/api/health')
      .set('Origin', disallowedOrigin);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('rejects DELETE requests with disallowed Origin', async () => {
    const res = await request(app)
      .delete('/api/health')
      .set('Origin', disallowedOrigin);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('rejects requests carrying Origin: null (e.g. sandboxed iframe CSRF vectors)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'null')
      .send({ email: 'test@example.com', password: 'password123' });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });
});

