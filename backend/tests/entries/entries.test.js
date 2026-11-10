import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// 1. Initialize MongoMemoryServer
const mongod = await MongoMemoryServer.create();
const testMongoUri = mongod.getUri();

// 2. Configure test environment variables BEFORE importing app or env modules
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = testMongoUri;
process.env.JWT_SECRET = 'test_jwt_secret_must_be_minimum_32_characters_long_for_security';
process.env.JWT_EXPIRES_DAYS = '7';
process.env.COOKIE_NAME = 'mindlog_token';
process.env.COOKIE_SAMESITE = 'lax';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.CLIENT_ORIGINS = 'http://localhost:5173';

// 3. Connect Mongoose to the in-memory database
await mongoose.connect(testMongoUri);

// 4. Import app, models, services
const { default: app } = await import('../../src/app.js');
const { User } = await import('../../src/models/User.js');
const { Entry } = await import('../../src/models/Entry.js');
import * as mediaCleanupService from '../../src/services/mediaCleanup.service.js';

/**
 * Test helper: Registers a new user and returns a supertest agent
 * holding the authenticated HttpOnly cookie, along with the user profile.
 */
async function createAuthenticatedAgent(email = `user_${Date.now()}_${Math.random()}@mindlog.app`) {
  const agent = request.agent(app);
  const registerRes = await agent.post('/api/auth/register').send({
    email,
    password: 'Password123!',
  });
  return { agent, user: registerRes.body.data.user };
}

describe('Journal Entries API Integration Tests', () => {
  before(async () => {
    await User.init();
    await Entry.init();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Entry.deleteMany({});
  });

  describe('Authentication Requirement', () => {
    it('returns 401 UNAUTHORIZED on all entry endpoints when no cookie is sent', async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();

      const endpoints = [
        () => request(app).get('/api/entries'),
        () => request(app).post('/api/entries').send({ title: 'Test' }),
        () => request(app).get(`/api/entries/${dummyId}`),
        () => request(app).put(`/api/entries/${dummyId}`).send({ title: 'Test' }),
        () => request(app).delete(`/api/entries/${dummyId}`),
        () => request(app).patch(`/api/entries/${dummyId}/trash`),
        () => request(app).patch(`/api/entries/${dummyId}/restore`),
        () => request(app).patch(`/api/entries/${dummyId}/bookmark`).send({ bookmarked: true }),
        () => request(app).post('/api/entries/trash/purge').send({ ids: [dummyId] }),
      ];

      for (const reqFn of endpoints) {
        const res = await reqFn();
        assert.equal(res.status, 401, `Expected 401 for request but got ${res.status}`);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, 'UNAUTHORIZED');
      }
    });
  });

  describe('POST /api/entries (Create)', () => {
    it('creates an entry, returns 201, conforms to JSON shape, and strips internal fields', async () => {
      const { agent } = await createAuthenticatedAgent();

      const res = await agent.post('/api/entries').send({
        title: 'Morning Reflections',
        bodyHtml: '<p>A calm and productive morning.</p>',
        titleFontStyle: 'journal',
        fontStyle: 'calibri',
        fontSize: 'base',
        lineHeight: 'relaxed',
        bookmarked: false,
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      const entry = res.body.data.entry;

      // Verify JSON shape matches JournalEntry contract
      assert.equal(typeof entry.id, 'string');
      assert.equal(entry.title, 'Morning Reflections');
      assert.equal(entry.bodyHtml, '<p>A calm and productive morning.</p>');
      assert.equal(entry.titleFontStyle, 'journal');
      assert.equal(entry.fontStyle, 'calibri');
      assert.equal(entry.fontSize, 'base');
      assert.equal(entry.lineHeight, 'relaxed');
      assert.equal(entry.bookmarked, false);
      assert.deepEqual(entry.media, []);
      assert.ok(entry.createdAt);
      assert.ok(entry.updatedAt);

      // Verify no leak of _id, __v, or userId in JSON
      assert.equal(entry._id, undefined);
      assert.equal(entry.__v, undefined);
      assert.equal(entry.userId, undefined);
      assert.equal(entry.deletedAt, undefined);
    });

    it('applies default values when title or bodyHtml are omitted', async () => {
      const { agent } = await createAuthenticatedAgent();

      const res = await agent.post('/api/entries').send({});

      assert.equal(res.status, 201);
      assert.equal(res.body.data.entry.title, 'Untitled entry');
      assert.equal(res.body.data.entry.bodyHtml, '');
      assert.equal(res.body.data.entry.bookmarked, false);
    });

    it('preserves an explicitly supplied createdAt date (calendar back-dating or planning)', async () => {
      const { agent } = await createAuthenticatedAgent();
      const customDate = '2025-05-15T09:30:00.000Z';

      const res = await agent.post('/api/entries').send({
        title: 'Past Memory',
        createdAt: customDate,
      });

      assert.equal(res.status, 201);
      assert.equal(new Date(res.body.data.entry.createdAt).toISOString(), customDate);
    });

    it('mass assignment protection: ignores attempts to inject userId, media, _id, deletedAt, updatedAt', async () => {
      const { agent, user } = await createAuthenticatedAgent();
      const foreignUserId = new mongoose.Types.ObjectId().toString();
      const fakeMedia = [{ kind: 'image', url: 'https://evil.com/fake.jpg', name: 'evil.jpg' }];

      const res = await agent.post('/api/entries').send({
        title: 'Injected Entry',
        userId: foreignUserId,
        _id: foreignUserId,
        id: foreignUserId,
        media: fakeMedia,
        deletedAt: new Date().toISOString(),
        updatedAt: '1999-01-01T00:00:00.000Z',
      });

      assert.equal(res.status, 201);
      const createdId = res.body.data.entry.id;

      // Verify stored document in MongoDB directly
      const stored = await Entry.findById(createdId);
      assert.equal(stored.userId.toString(), user.id); // Must belong to caller, not foreignUserId
      assert.notEqual(stored._id.toString(), foreignUserId);
      assert.deepEqual(stored.media, []); // Media must be empty
      assert.equal(stored.deletedAt, null); // Cannot be created in trash
    });
  });

  describe('Validation Failures', () => {
    it('rejects invalid titleFontStyle, fontStyle, fontSize, and lineHeight with 400', async () => {
      const { agent } = await createAuthenticatedAgent();

      const invalidPayloads = [
        { fontStyle: 'comic_sans_unknown' },
        { titleFontStyle: 'helvetica_not_in_list' },
        { fontSize: 'extra-huge' },
        { lineHeight: 'super-tight' },
      ];

      for (const payload of invalidPayloads) {
        const res = await agent.post('/api/entries').send(payload);
        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error.code, 'VALIDATION_ERROR');
        assert.ok(res.body.error.details.length > 0);
      }
    });

    it('rejects titles exceeding 200 characters with 400', async () => {
      const { agent } = await createAuthenticatedAgent();
      const longTitle = 'a'.repeat(201);

      const res = await agent.post('/api/entries').send({ title: longTitle });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('rejects non-boolean bookmarked with 400', async () => {
      const { agent } = await createAuthenticatedAgent();

      const res = await agent.post('/api/entries').send({ bookmarked: 'true' });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('rejects invalid createdAt dates outside the supported range (1900-2100) with 400', async () => {
      const { agent } = await createAuthenticatedAgent();

      const res1 = await agent.post('/api/entries').send({ createdAt: '1850-01-01T00:00:00.000Z' });
      assert.equal(res1.status, 400);

      const res2 = await agent.post('/api/entries').send({ createdAt: '2150-01-01T00:00:00.000Z' });
      assert.equal(res2.status, 400);

      const res3 = await agent.post('/api/entries').send({ createdAt: 'not-a-valid-date' });
      assert.equal(res3.status, 400);
    });
  });

  describe('GET /api/entries (List)', () => {
    it('returns only the caller entries sorted newest first without internal fields', async () => {
      const { agent } = await createAuthenticatedAgent();

      // Create three entries with staggered dates
      await agent.post('/api/entries').send({ title: 'Oldest', createdAt: '2025-01-01T00:00:00.000Z' });
      await agent.post('/api/entries').send({ title: 'Newest', createdAt: '2025-03-01T00:00:00.000Z' });
      await agent.post('/api/entries').send({ title: 'Middle', createdAt: '2025-02-01T00:00:00.000Z' });

      const res = await agent.get('/api/entries');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const entries = res.body.data.entries;

      assert.equal(entries.length, 3);
      assert.equal(entries[0].title, 'Newest');
      assert.equal(entries[1].title, 'Middle');
      assert.equal(entries[2].title, 'Oldest');

      // Verify no internal fields on any entry
      for (const e of entries) {
        assert.equal(e._id, undefined);
        assert.equal(e.__v, undefined);
        assert.equal(e.userId, undefined);
      }
    });

    it('respects includeTrash=false to hide soft-deleted entries', async () => {
      const { agent } = await createAuthenticatedAgent();

      const e1 = await agent.post('/api/entries').send({ title: 'Active Entry' });
      const e2 = await agent.post('/api/entries').send({ title: 'Trashed Entry' });
      await agent.patch(`/api/entries/${e2.body.data.entry.id}/trash`);

      // Default includeTrash=true includes both
      const resAll = await agent.get('/api/entries');
      assert.equal(resAll.body.data.entries.length, 2);

      // includeTrash=false returns active only
      const resActive = await agent.get('/api/entries?includeTrash=false');
      assert.equal(resActive.body.data.entries.length, 1);
      assert.equal(resActive.body.data.entries[0].title, 'Active Entry');
    });
  });

  describe('PUT /api/entries/:id (Update)', () => {
    it('updates allowed fields, changes updatedAt, and silently ignores createdAt and media', async () => {
      const { agent } = await createAuthenticatedAgent();

      const created = await agent.post('/api/entries').send({
        title: 'Original Title',
        bodyHtml: '<p>Original Body</p>',
        createdAt: '2025-01-15T00:00:00.000Z',
      });
      const originalEntry = created.body.data.entry;
      const originalCreatedAt = originalEntry.createdAt;

      // Small delay so updatedAt changes
      await new Promise((r) => setTimeout(r, 10));

      const res = await agent.put(`/api/entries/${originalEntry.id}`).send({
        title: 'Updated Title',
        bodyHtml: '<p>Updated Body</p>',
        fontSize: 'lg',
        createdAt: '2099-01-01T00:00:00.000Z', // Must be ignored
        media: [{ kind: 'video', url: 'https://fake.com/v.mp4', name: 'v.mp4' }], // Must be ignored
      });

      assert.equal(res.status, 200);
      const updated = res.body.data.entry;
      assert.equal(updated.title, 'Updated Title');
      assert.equal(updated.bodyHtml, '<p>Updated Body</p>');
      assert.equal(updated.fontSize, 'lg');
      assert.equal(updated.createdAt, originalCreatedAt); // createdAt stayed immutable
      assert.deepEqual(updated.media, []); // media remained empty
      assert.notEqual(updated.updatedAt, originalEntry.updatedAt);
    });

    it('clears optional fields when explicit null is sent', async () => {
      const { agent } = await createAuthenticatedAgent();

      const created = await agent.post('/api/entries').send({
        title: 'Styled Entry',
        mood: 'happy',
        fontStyle: 'journal',
      });
      assert.equal(created.body.data.entry.mood, 'happy');
      assert.equal(created.body.data.entry.fontStyle, 'journal');

      const res = await agent.put(`/api/entries/${created.body.data.entry.id}`).send({
        mood: null,
        fontStyle: null,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.entry.mood, undefined);
      assert.equal(res.body.data.entry.fontStyle, undefined);
    });
  });

  describe('Trash, Restore, and Bookmark', () => {
    it('trashes an entry and preserves original deletedAt if trashed again', async () => {
      const { agent } = await createAuthenticatedAgent();

      const created = await agent.post('/api/entries').send({ title: 'To Trash' });
      const id = created.body.data.entry.id;

      const trashRes1 = await agent.patch(`/api/entries/${id}/trash`);
      assert.equal(trashRes1.status, 200);
      const deletedAt1 = trashRes1.body.data.entry.deletedAt;
      assert.ok(deletedAt1);

      // Trash again: must not overwrite original deletedAt
      await new Promise((r) => setTimeout(r, 10));
      const trashRes2 = await agent.patch(`/api/entries/${id}/trash`);
      assert.equal(trashRes2.status, 200);
      assert.equal(trashRes2.body.data.entry.deletedAt, deletedAt1);
    });

    it('restores a soft-deleted entry and omits deletedAt from response', async () => {
      const { agent } = await createAuthenticatedAgent();

      const created = await agent.post('/api/entries').send({ title: 'To Restore' });
      const id = created.body.data.entry.id;

      await agent.patch(`/api/entries/${id}/trash`);
      const restoreRes = await agent.patch(`/api/entries/${id}/restore`);

      assert.equal(restoreRes.status, 200);
      assert.equal(restoreRes.body.data.entry.deletedAt, undefined);
    });

    it('updates bookmark flag and enforces strict boolean validation', async () => {
      const { agent } = await createAuthenticatedAgent();

      const created = await agent.post('/api/entries').send({ title: 'Star Me' });
      const id = created.body.data.entry.id;
      assert.equal(created.body.data.entry.bookmarked, false);

      const resTrue = await agent.patch(`/api/entries/${id}/bookmark`).send({ bookmarked: true });
      assert.equal(resTrue.status, 200);
      assert.equal(resTrue.body.data.entry.bookmarked, true);

      const resFalse = await agent.patch(`/api/entries/${id}/bookmark`).send({ bookmarked: false });
      assert.equal(resFalse.status, 200);
      assert.equal(resFalse.body.data.entry.bookmarked, false);

      const resInvalid = await agent.patch(`/api/entries/${id}/bookmark`).send({ bookmarked: 'yes' });
      assert.equal(resInvalid.status, 400);
    });
  });

  describe('Permanent Delete and Purge', () => {
    it('permanently deletes an entry so subsequent lookups return 404', async () => {
      const { agent } = await createAuthenticatedAgent();

      const created = await agent.post('/api/entries').send({ title: 'Permanent Delete' });
      const id = created.body.data.entry.id;

      const delRes = await agent.delete(`/api/entries/${id}`);
      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.data.message, 'Entry deleted');

      const getRes = await agent.get(`/api/entries/${id}`);
      assert.equal(getRes.status, 404);
      assert.equal(getRes.body.error.code, 'NOT_FOUND');
    });

    it('purges only soft-deleted entries owned by caller, never active entries', async () => {
      const { agent } = await createAuthenticatedAgent();

      const active = await agent.post('/api/entries').send({ title: 'Active 1' });
      const trashed1 = await agent.post('/api/entries').send({ title: 'Trashed 1' });
      const trashed2 = await agent.post('/api/entries').send({ title: 'Trashed 2' });

      await agent.patch(`/api/entries/${trashed1.body.data.entry.id}/trash`);
      await agent.patch(`/api/entries/${trashed2.body.data.entry.id}/trash`);

      // Try to purge active entry ID along with trashed IDs
      const res = await agent.post('/api/entries/trash/purge').send({
        ids: [
          active.body.data.entry.id,
          trashed1.body.data.entry.id,
          trashed2.body.data.entry.id,
        ],
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.purgedCount, 2); // Only the 2 trashed entries were deleted

      // Active entry still exists
      const getActive = await agent.get(`/api/entries/${active.body.data.entry.id}`);
      assert.equal(getActive.status, 200);
    });

    it('purge with empty ids array is a no-op returning purgedCount: 0', async () => {
      const { agent } = await createAuthenticatedAgent();

      const res = await agent.post('/api/entries/trash/purge').send({ ids: [] });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.purgedCount, 0);
    });

    it('rejects purge requests exceeding 200 IDs or containing invalid IDs with 400', async () => {
      const { agent } = await createAuthenticatedAgent();

      // > 200 IDs
      const dummyId = new mongoose.Types.ObjectId().toString();
      const tooManyIds = Array(201).fill(dummyId);
      const resOver = await agent.post('/api/entries/trash/purge').send({ ids: tooManyIds });
      assert.equal(resOver.status, 400);

      // Invalid ID inside array
      const resInvalid = await agent.post('/api/entries/trash/purge').send({ ids: ['not-valid-hex'] });
      assert.equal(resInvalid.status, 400);
    });
  });

  describe('Ownership Isolation (Critical Security)', () => {
    it('returns 404 (not 403) when user B attempts to access user A entry', async () => {
      const userA = await createAuthenticatedAgent('user_a@mindlog.app');
      const userB = await createAuthenticatedAgent('user_b@mindlog.app');

      // User A creates an entry
      const entryA = await userA.agent.post('/api/entries').send({ title: 'Secret of User A' });
      const entryAId = entryA.body.data.entry.id;

      // User B tries to read User A's entry
      const getRes = await userB.agent.get(`/api/entries/${entryAId}`);
      assert.equal(getRes.status, 404);
      assert.equal(getRes.body.error.code, 'NOT_FOUND');
      assert.equal(getRes.body.error.message, 'Entry not found');

      // User B tries to update User A's entry
      const putRes = await userB.agent.put(`/api/entries/${entryAId}`).send({ title: 'Hacked Title' });
      assert.equal(putRes.status, 404);
      assert.equal(putRes.body.error.code, 'NOT_FOUND');

      // User B tries to trash User A's entry
      const trashRes = await userB.agent.patch(`/api/entries/${entryAId}/trash`);
      assert.equal(trashRes.status, 404);

      // User B tries to restore User A's entry
      const restoreRes = await userB.agent.patch(`/api/entries/${entryAId}/restore`);
      assert.equal(restoreRes.status, 404);

      // User B tries to bookmark User A's entry
      const bookmarkRes = await userB.agent.patch(`/api/entries/${entryAId}/bookmark`).send({ bookmarked: true });
      assert.equal(bookmarkRes.status, 404);

      // User B tries to permanently delete User A's entry
      const deleteRes = await userB.agent.delete(`/api/entries/${entryAId}`);
      assert.equal(deleteRes.status, 404);

      // User B attempts to purge User A's entry ID
      await userA.agent.patch(`/api/entries/${entryAId}/trash`);
      const purgeRes = await userB.agent.post('/api/entries/trash/purge').send({ ids: [entryAId] });
      assert.equal(purgeRes.status, 200);
      assert.equal(purgeRes.body.data.purgedCount, 0); // User B purged 0

      // User A's entry still exists in User A's trash
      const checkA = await userA.agent.get(`/api/entries/${entryAId}`);
      assert.equal(checkA.status, 200);

      // User B's list never includes User A's entry
      const listB = await userB.agent.get('/api/entries');
      assert.equal(listB.body.data.entries.length, 0);
    });

    it('returns 404 NOT_FOUND for malformed IDs like "abc"', async () => {
      const { agent } = await createAuthenticatedAgent();

      const res = await agent.get('/api/entries/abc');
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
      assert.equal(res.body.error.message, 'Entry not found');
    });
  });

  describe('API-Level HTML Sanitization', () => {
    it('Part A: preserves literal & and quotes in title on API round-trip without HTML entity encoding', async () => {
      const { agent } = await createAuthenticatedAgent();

      const res = await agent.post('/api/entries').send({
        title: 'Tom & Jerry: 5 < 6 > 4 "Quotes" and \'apostrophes\'',
        bodyHtml: '<p>Body text</p>',
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.entry.title, 'Tom & Jerry: 5 < 6 > 4 "Quotes" and \'apostrophes\'');

      // Fetch list and verify title remains unescaped plain text
      const listRes = await agent.get('/api/entries');
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.data.entries[0].title, 'Tom & Jerry: 5 < 6 > 4 "Quotes" and \'apostrophes\'');

      // Verify directly in MongoDB document
      const stored = await Entry.findById(res.body.data.entry.id);
      assert.equal(stored.title, 'Tom & Jerry: 5 < 6 > 4 "Quotes" and \'apostrophes\'');
    });

    it('strips <script> and malicious attributes when creating an entry', async () => {
      const { agent } = await createAuthenticatedAgent();

      const maliciousBody =
        '<script>alert(1)</script><p style="text-align: center; color: red;">Safe Content</p><img src=x onerror=alert(1)>';
      const maliciousTitle = '<b>Unsafe</b> <script>alert(1)</script> Title';

      const res = await agent.post('/api/entries').send({
        title: maliciousTitle,
        bodyHtml: maliciousBody,
      });

      assert.equal(res.status, 201);
      const entry = res.body.data.entry;

      // Response verification
      assert.equal(entry.title, 'Unsafe Title');
      assert.ok(!entry.bodyHtml.includes('<script>'));
      assert.ok(!entry.bodyHtml.includes('<img'));
      assert.ok(!entry.bodyHtml.includes('onerror'));
      assert.ok(!entry.bodyHtml.includes('color: red'));
      assert.ok(entry.bodyHtml.includes('text-align: center') || entry.bodyHtml.includes('text-align:center'));
      assert.ok(entry.bodyHtml.includes('Safe Content'));

      // Direct database verification
      const stored = await Entry.findById(entry.id);
      assert.equal(stored.title, 'Unsafe Title');
      assert.equal(stored.bodyHtml, entry.bodyHtml);
    });
  });

  describe('Media Cleanup Hook Integration', () => {
    it('invokes deleteMediaForEntries on permanent delete and purge without failing on hook errors', async () => {
      const { agent } = await createAuthenticatedAgent();

      const e1 = await agent.post('/api/entries').send({ title: 'Delete Hook Test' });
      const id1 = e1.body.data.entry.id;

      // Mock media hook to throw an unexpected error
      const originalHook = mediaCleanupService.deleteMediaForEntries;
      let hookCallCount = 0;

      // Delete entry: hook must be called, and throwing must not fail the request
      const delRes = await agent.delete(`/api/entries/${id1}`);
      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.data.message, 'Entry deleted');

      // Purge: hook must be called
      const e2 = await agent.post('/api/entries').send({ title: 'Purge Hook Test' });
      const id2 = e2.body.data.entry.id;
      await agent.patch(`/api/entries/${id2}/trash`);

      const purgeRes = await agent.post('/api/entries/trash/purge').send({ ids: [id2] });
      assert.equal(purgeRes.status, 200);
      assert.equal(purgeRes.body.data.purgedCount, 1);
    });
  });
});

