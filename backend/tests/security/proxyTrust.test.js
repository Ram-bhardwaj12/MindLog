import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';

describe('Security Hardening: Reverse Proxy Trust Tests (Phase 8 A2)', () => {
  it('correctly derives client IP for hops = 1 from X-Forwarded-For header', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.get('/test-ip', (req, res) => {
      res.json({ ip: req.ip, ips: req.ips });
    });

    // Multi-entry header simulating: Client -> Proxy 1 (e.g. Render) -> Express
    const res = await request(app)
      .get('/test-ip')
      .set('X-Forwarded-For', '203.0.113.195, 198.51.100.10');

    assert.equal(res.status, 200);
    // With 1 hop trusted from socket, Express trusts 198.51.100.10, deriving client 198.51.100.10
    assert.equal(res.body.ip, '198.51.100.10');
    assert.deepEqual(res.body.ips, ['198.51.100.10']);
  });

  it('correctly derives client IP for hops = 2 through two reverse proxies (Vercel -> Render -> Express)', async () => {
    const app = express();
    app.set('trust proxy', 2);
    app.get('/test-ip', (req, res) => {
      res.json({ ip: req.ip, ips: req.ips });
    });

    // Multi-entry header simulating: Real Client (203.0.113.195) -> Vercel (198.51.100.10) -> Render (Socket) -> Express
    const res = await request(app)
      .get('/test-ip')
      .set('X-Forwarded-For', '203.0.113.195, 198.51.100.10');

    assert.equal(res.status, 200);
    // With 2 hops trusted (Render socket + Vercel entry), Express arrives at the true client IP: 203.0.113.195
    assert.equal(res.body.ip, '203.0.113.195');
    assert.deepEqual(res.body.ips, ['203.0.113.195', '198.51.100.10']);
  });

  it('proves hops = 0 ignores X-Forwarded-For entirely and uses socket remoteAddress', async () => {
    const app = express();
    app.set('trust proxy', 0);
    app.get('/test-ip', (req, res) => {
      res.json({ ip: req.ip });
    });

    const res = await request(app)
      .get('/test-ip')
      .set('X-Forwarded-For', '203.0.113.195');

    assert.equal(res.status, 200);
    // When trust proxy is 0, X-Forwarded-For is ignored (spoofed header rejected)
    assert.notEqual(res.body.ip, '203.0.113.195');
  });
});
