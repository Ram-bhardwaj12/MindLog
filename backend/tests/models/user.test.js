import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import User from '../../src/models/User.js';

describe('User Model Tests (No Database Required)', () => {
  it('requires email and passwordHash', () => {
    const user = new User({});
    const error = user.validateSync();

    assert.ok(error);
    assert.ok(error.errors.email);
    assert.ok(error.errors.passwordHash);
  });

  it('lowercases and trims email', () => {
    const user = new User({
      email: '  Author.User@Example.COM  ',
      passwordHash: 'hashed_password_123',
    });

    assert.equal(user.email, 'author.user@example.com');
  });

  it('rejects invalid email formats', () => {
    const invalidEmails = ['plainaddress', '@missingusername.com', 'user@.com', 'user@domain'];

    for (const email of invalidEmails) {
      const user = new User({ email, passwordHash: 'hashed_123' });
      const err = user.validateSync();
      assert.ok(err, `Expected email ${email} to be invalid`);
      assert.ok(err.errors.email);
    }
  });

  it('rejects emails exceeding 254 characters', () => {
    const longEmail = `${'a'.repeat(245)}@example.com`;
    const user = new User({ email: longEmail, passwordHash: 'hashed_123' });
    const err = user.validateSync();
    assert.ok(err);
    assert.ok(err.errors.email);
  });

  it('declares passwordHash with select: false in schema definition', () => {
    const path = User.schema.path('passwordHash');
    assert.equal(path.options.select, false);
  });

  it('toJSON() never includes passwordHash, _id, or __v, and provides string id', () => {
    const user = new User({
      email: 'sanctuary@mindlog.app',
      passwordHash: 'secret_hash_not_to_be_leaked',
    });

    const json = user.toJSON();

    assert.equal(typeof json.id, 'string');
    assert.equal(json.id.length, 24);
    assert.equal(json.email, 'sanctuary@mindlog.app');
    assert.equal(json.passwordHash, undefined);
    assert.equal(json._id, undefined);
    assert.equal(json.__v, undefined);
  });

  it('declares unique index on email in schema indexes', () => {
    const indexes = User.schema.indexes();
    const hasUniqueEmail = indexes.some(
      ([fields, options]) => fields.email === 1 && options && options.unique === true
    );
    assert.ok(hasUniqueEmail, 'Expected unique email index in User.schema.indexes()');
  });
});

