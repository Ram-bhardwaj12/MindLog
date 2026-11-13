import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { env } from '../../src/config/env.js';

describe('Security Hardening: Centralized Error Handler Tests (Phase 8 A4)', () => {
  it('in production mode, yields 500 INTERNAL_ERROR with fixed message, no stack, no file paths, and zero message leakage', () => {
    // Temporarily set isProduction to true
    const originalIsProduction = env.isProduction;
    env.isProduction = true;

    try {
      const sensitiveLeakError = new Error(
        'Database connection failed at mongodb://admin:SecretPass123@10.0.0.5:27017/mindlog in /var/www/backend/src/secret.js:88'
      );
      sensitiveLeakError.stack = 'Error at /var/www/backend/src/secret.js:88:12\n    at internal/process';

      let statusCode = 200;
      let responseBody = null;

      const mockReq = {};
      const mockRes = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
      };

      errorHandler(sensitiveLeakError, mockReq, mockRes, () => {});

      assert.equal(statusCode, 500);
      assert.equal(responseBody.success, false);
      assert.equal(responseBody.error.code, 'INTERNAL_ERROR');
      assert.equal(responseBody.error.message, 'An unexpected internal server error occurred');
      assert.deepEqual(responseBody.error.details, []);

      // Verify that no stack trace, file path, secret password, or error echo exists in the response
      const serialized = JSON.stringify(responseBody);
      assert.equal(serialized.includes('SecretPass123'), false, 'Response must never leak secrets');
      assert.equal(serialized.includes('/var/www'), false, 'Response must never leak filesystem paths');
      assert.equal(serialized.includes('stack'), false, 'Response must never leak stack property');
      assert.equal(
        serialized.includes('Database connection failed'),
        false,
        'Response must never echo internal error messages'
      );
    } finally {
      env.isProduction = originalIsProduction;
    }
  });
});

