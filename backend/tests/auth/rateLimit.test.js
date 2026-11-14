import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createAuthRateLimiter } from '../../src/middleware/rateLimiter.js';

describe('Rate Limiter Tests', () => {
  it('returns 429 TOO_MANY_REQUESTS in standard error envelope when threshold exceeded', async () => {
    const testApp = express();

    // Create a tight limiter allowing max 2 requests
    const tightLimiter = createAuthRateLimiter({
      windowMs: 60 * 1000,
      max: 2,
      message: 'Too many requests for test',
    });

    testApp.use(tightLimiter);
    testApp.post('/test-limit', (req, res) => res.status(200).json({ ok: true }));

    // Request 1: Allowed
    const res1 = await request(testApp).post('/test-limit');
    assert.equal(res1.status, 200);

    // Request 2: Allowed
    const res2 = await request(testApp).post('/test-limit');
    assert.equal(res2.status, 200);

    // Request 3: Exceeded -> 429
    const res3 = await request(testApp).post('/test-limit');
    assert.equal(res3.status, 429);
    assert.equal(res3.body.success, false);
    assert.equal(res3.body.error.code, 'TOO_MANY_REQUESTS');
    assert.equal(res3.body.error.message, 'Too many requests for test');
    assert.deepEqual(res3.body.error.details, []);
  });
});

