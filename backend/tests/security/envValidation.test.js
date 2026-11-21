import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { envSchema, validateEnv } from '../../src/config/env.js';

describe('Security Hardening: Environment Validation Tests (Phase 8 A4)', () => {
  const baseValidProduction = {
    NODE_ENV: 'production',
    PORT: '5000',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/mindlog',
    CLIENT_ORIGINS: 'https://mindlog.example.com,https://app.mindlog.example.com',
    JWT_SECRET: 'a_very_strong_production_secret_key_exceeding_32_characters_strictly',
    CLOUDINARY_CLOUD_NAME: 'prod_cloud',
    CLOUDINARY_API_KEY: '1234567890',
    CLOUDINARY_API_SECRET: 'abcdefghijklmnopqrstuvwxyz012345',
    TRUST_PROXY_HOPS: '2',
    EMAIL_PROVIDER: 'brevo',
    BREVO_API_KEY: 'xkeysib-test-production-brevo-key-12345',
    EMAIL_FROM_ADDRESS: 'noreply@mindlog.app',
    EMAIL_FROM_NAME: 'MindLog',
    FRONTEND_URL: 'https://mind-log-smoky.vercel.app',
    PASSWORD_RESET_TTL_MINUTES: '30',
  };

  it('passes validation when production configuration is fully valid', () => {
    const parsed = validateEnv(baseValidProduction, false);
    assert.equal(parsed.isProduction, true);
    assert.equal(parsed.trustProxyHops, 2);
    assert.deepEqual(parsed.clientOrigins, [
      'https://mindlog.example.com',
      'https://app.mindlog.example.com',
    ]);
  });

  describe('CLIENT_ORIGINS Production Validation', () => {
    it('fails fast if CLIENT_ORIGINS is missing in production mode', () => {
      const invalid = { ...baseValidProduction, CLIENT_ORIGINS: '' };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const fields = err.issues.map((i) => i.path.join('.'));
          return fields.includes('CLIENT_ORIGINS');
        }
      );
    });

    it('fails fast if CLIENT_ORIGINS contains localhost in production mode', () => {
      const invalid = {
        ...baseValidProduction,
        CLIENT_ORIGINS: 'https://mindlog.com,http://localhost:5173',
      };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('CLIENT_ORIGINS'));
          return issue && issue.message.includes('localhost');
        }
      );
    });

    it('fails fast if any CLIENT_ORIGINS entry does not start with https:// in production mode', () => {
      const invalid = {
        ...baseValidProduction,
        CLIENT_ORIGINS: 'http://insecure.mindlog.com',
      };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('CLIENT_ORIGINS'));
          return issue && issue.message.includes('https://');
        }
      );
    });
  });

  describe('JWT_SECRET Placeholder Rejection', () => {
    it('rejects secrets containing "your_" in production', () => {
      const invalid = {
        ...baseValidProduction,
        JWT_SECRET: 'your_production_secret_key_that_is_at_least_32_characters_long',
      };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('JWT_SECRET'));
          return issue && issue.message.includes('template placeholder');
        }
      );
    });

    it('rejects secrets containing "changeme" in production', () => {
      const invalid = {
        ...baseValidProduction,
        JWT_SECRET: 'please_changeme_before_deploying_to_live_production_now',
      };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('JWT_SECRET'));
          return issue && issue.message.includes('template placeholder');
        }
      );
    });

    it('rejects the exact .env.example placeholder secret in production', () => {
      const invalid = {
        ...baseValidProduction,
        JWT_SECRET: 'your_minimum_32_characters_long_jwt_secret_here',
      };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('JWT_SECRET'));
          return issue && issue.message.includes('template placeholder');
        }
      );
    });
  });

  describe('TRUST_PROXY_HOPS Validation', () => {
    it('defaults to 1 when omitted', () => {
      const withoutHops = { ...baseValidProduction };
      delete withoutHops.TRUST_PROXY_HOPS;
      const parsed = validateEnv(withoutHops, false);
      assert.equal(parsed.trustProxyHops, 1);
    });

    it('accepts integer hops between 0 and 5', () => {
      for (let n = 0; n <= 5; n++) {
        const parsed = validateEnv({ ...baseValidProduction, TRUST_PROXY_HOPS: String(n) }, false);
        assert.equal(parsed.trustProxyHops, n);
      }
    });

    it('rejects negative hops or hops exceeding 5', () => {
      assert.throws(() => validateEnv({ ...baseValidProduction, TRUST_PROXY_HOPS: '-1' }, false));
      assert.throws(() => validateEnv({ ...baseValidProduction, TRUST_PROXY_HOPS: '6' }, false));
    });
  });

  describe('Email & Password Reset Production Validation (Phase 7)', () => {
    it('rejects console email provider in production mode', () => {
      const invalid = { ...baseValidProduction, EMAIL_PROVIDER: 'console' };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('EMAIL_PROVIDER'));
          return issue && issue.message.includes('brevo');
        }
      );
    });

    it('rejects missing BREVO_API_KEY when EMAIL_PROVIDER is brevo', () => {
      const invalid = { ...baseValidProduction, BREVO_API_KEY: '' };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('BREVO_API_KEY'));
          return issue && issue.message.includes('BREVO_API_KEY is required');
        }
      );
    });

    it('rejects missing or invalid EMAIL_FROM_ADDRESS when EMAIL_PROVIDER is brevo', () => {
      const missing = { ...baseValidProduction, EMAIL_FROM_ADDRESS: '' };
      assert.throws(
        () => validateEnv(missing, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('EMAIL_FROM_ADDRESS'));
          return issue && issue.message.includes('EMAIL_FROM_ADDRESS is required');
        }
      );

      const invalidEmail = { ...baseValidProduction, EMAIL_FROM_ADDRESS: 'not-an-email' };
      assert.throws(
        () => validateEnv(invalidEmail, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('EMAIL_FROM_ADDRESS'));
          return issue && issue.message.includes('valid email address');
        }
      );
    });

    it('rejects missing FRONTEND_URL in production mode', () => {
      const invalid = { ...baseValidProduction, FRONTEND_URL: '' };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('FRONTEND_URL'));
          return issue && issue.message.includes('FRONTEND_URL is required');
        }
      );
    });

    it('rejects http:// FRONTEND_URL in production mode', () => {
      const invalid = { ...baseValidProduction, FRONTEND_URL: 'http://mind-log-smoky.vercel.app' };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('FRONTEND_URL'));
          return issue && issue.message.includes('https://');
        }
      );
    });

    it('rejects FRONTEND_URL containing localhost in production mode', () => {
      const invalid = { ...baseValidProduction, FRONTEND_URL: 'https://localhost:5173' };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('FRONTEND_URL'));
          return issue && issue.message.includes('localhost');
        }
      );
    });

    it('rejects FRONTEND_URL with a trailing slash in production mode', () => {
      const invalid = { ...baseValidProduction, FRONTEND_URL: 'https://mind-log-smoky.vercel.app/' };
      assert.throws(
        () => validateEnv(invalid, false),
        (err) => {
          const issue = err.issues.find((i) => i.path.includes('FRONTEND_URL'));
          return issue && issue.message.includes('trailing slash');
        }
      );
    });
  });
});

