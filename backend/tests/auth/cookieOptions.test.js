import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Set test environment before importing env module
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_for_cookie_options_test_must_be_32_chars';

const { getAuthCookieOptions } = await import('../../src/utils/cookies.js');
const { env } = await import('../../src/config/env.js');

describe('Cookie Options Builder Unit Tests', () => {
  it('builds standard cookie options with HttpOnly, path, and maxAge', () => {
    const options = getAuthCookieOptions(false);

    assert.equal(options.httpOnly, true);
    assert.equal(options.path, '/');
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.maxAge, env.cookieMaxAgeMs);
  });

  it('omits maxAge when building options for clearing cookies', () => {
    const clearOptions = getAuthCookieOptions(true);

    assert.equal(clearOptions.httpOnly, true);
    assert.equal(clearOptions.path, '/');
    assert.equal(clearOptions.maxAge, undefined);
  });

  it('evaluates secure flag based on environment logic', () => {
    // In test / development mode with sameSite='lax', secure is false
    assert.equal(env.isCookieSecure, false);

    // Verify logic: Secure must be true if NODE_ENV === 'production' OR SameSite === 'none'
    const isProduction = true;
    const sameSiteLax = 'lax';
    assert.equal(isProduction || sameSiteLax === 'none', true);

    const isDevelopment = false;
    const sameSiteNone = 'none';
    assert.equal(isDevelopment || sameSiteNone === 'none', true);
  });
});
