import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Configure test environment variables for Brevo provider testing
process.env.NODE_ENV = 'test';
process.env.EMAIL_PROVIDER = 'brevo';
process.env.BREVO_API_KEY = 'xkeysib-test-fake-key-strictly-for-testing-1234567890';
process.env.EMAIL_FROM_ADDRESS = 'noreply@mindlog.app';
process.env.EMAIL_FROM_NAME = 'MindLog';
process.env.FRONTEND_URL = 'https://mind-log-smoky.vercel.app';
process.env.PASSWORD_RESET_TTL_MINUTES = '30';

const { emailClient, escapeHtml, buildPasswordResetTemplates } = await import(
  '../../src/services/email/index.js'
);
const { env, validateEnv } = await import('../../src/config/env.js');

describe('Email Service: Brevo Provider Unit Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mock.reset();
  });

  after(() => {
    global.fetch = originalFetch;
  });

  it('escapes special HTML characters properly', () => {
    const raw = '<script>alert("xss") & test \'quote\'</script>';
    const escaped = escapeHtml(raw);
    assert.equal(
      escaped,
      '&lt;script&gt;alert(&quot;xss&quot;) &amp; test &#39;quote&#39;&lt;/script&gt;'
    );
  });

  it('sends correct URL, headers, body structure and escapes HTML in email content', async () => {
    let capturedUrl = '';
    let capturedOptions = null;

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: '<test-message-id>' }),
      };
    };

    const maliciousUrl = 'https://mind-log-smoky.vercel.app/reset-password?token=test<script>&foo="bar"';
    await emailClient.sendPasswordResetEmail({
      to: 'recipient@mindlog.app',
      resetUrl: maliciousUrl,
      expiresMinutes: 30,
    });

    assert.equal(capturedUrl, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(capturedOptions.method, 'POST');
    assert.equal(capturedOptions.headers['api-key'], 'xkeysib-test-fake-key-strictly-for-testing-1234567890');
    assert.equal(capturedOptions.headers['content-type'], 'application/json');
    assert.equal(capturedOptions.headers['accept'], 'application/json');

    const parsedBody = JSON.parse(capturedOptions.body);
    assert.deepEqual(parsedBody.sender, {
      name: 'MindLog',
      email: 'noreply@mindlog.app',
    });
    assert.deepEqual(parsedBody.to, [{ email: 'recipient@mindlog.app' }]);
    assert.equal(parsedBody.subject, 'Reset your MindLog password');

    // Text content contains the plain URL and expiration minutes
    assert.ok(parsedBody.textContent.includes(maliciousUrl));
    assert.ok(parsedBody.textContent.includes('30 minutes'));

    // HTML content escapes the URL and does not contain raw <script> or unescaped quotes
    assert.ok(!parsedBody.htmlContent.includes('<script>'));
    assert.ok(parsedBody.htmlContent.includes('&lt;script&gt;'));
    assert.ok(parsedBody.htmlContent.includes('&quot;bar&quot;'));
  });

  it('throws a generic error on non-2xx response without leaking secrets or response body', async () => {
    const sensitiveBody = JSON.stringify({
      code: 'unauthorized',
      message: 'Key xkeysib-test-fake-key-strictly-for-testing-1234567890 is invalid',
      internalServerPath: '/var/secret/keys.json',
    });

    global.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => sensitiveBody,
    });

    await assert.rejects(
      async () => {
        await emailClient.sendPasswordResetEmail({
          to: 'recipient@mindlog.app',
          resetUrl: 'https://mind-log-smoky.vercel.app/reset-password?token=tok',
          expiresMinutes: 30,
        });
      },
      (err) => {
        // Must be generic error mentioning only status class
        assert.equal(err.message, 'Email delivery failed (4xx)');
        // Must NEVER contain the sensitive key or body details
        assert.ok(!err.message.includes('xkeysib'));
        assert.ok(!err.message.includes('/var/secret'));
        return true;
      }
    );
  });

  it('handles network timeouts (AbortError) with a generic error', async () => {
    global.fetch = async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    };

    await assert.rejects(
      async () => {
        await emailClient.sendPasswordResetEmail({
          to: 'recipient@mindlog.app',
          resetUrl: 'https://mind-log-smoky.vercel.app/reset-password?token=tok',
          expiresMinutes: 30,
        });
      },
      (err) => {
        assert.equal(err.message, 'Email delivery failed (timeout)');
        return true;
      }
    );
  });

  it('console email provider is strictly rejected in production env validation', () => {
    const prodConfig = {
      NODE_ENV: 'production',
      PORT: '5000',
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/mindlog',
      CLIENT_ORIGINS: 'https://mind-log-smoky.vercel.app',
      JWT_SECRET: 'super_strong_production_jwt_secret_with_more_than_32_characters',
      CLOUDINARY_CLOUD_NAME: 'prod_cloud',
      CLOUDINARY_API_KEY: '123456789',
      CLOUDINARY_API_SECRET: 'abcdefghijklmnopqrstuvwxyz012345',
      EMAIL_PROVIDER: 'console',
      FRONTEND_URL: 'https://mind-log-smoky.vercel.app',
    };

    assert.throws(
      () => validateEnv(prodConfig, false),
      (err) => {
        const issue = err.issues.find((i) => i.path.includes('EMAIL_PROVIDER'));
        return issue && issue.message.includes('brevo');
      }
    );
  });
});
