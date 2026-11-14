import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
process.env.CLOUDINARY_CLOUD_NAME = 'test_cloudinary_cloud';
process.env.CLOUDINARY_API_KEY = 'test_cloudinary_key';
process.env.CLOUDINARY_API_SECRET = 'DISTINCTIVE_SECRET_987654321_FAKE';

// 3. Connect Mongoose to the in-memory database
await mongoose.connect(testMongoUri);

// 4. Import app, models, services, env
const { default: app } = await import('../../src/app.js');
const { User } = await import('../../src/models/User.js');
const { Entry } = await import('../../src/models/Entry.js');
const { env } = await import('../../src/config/env.js');
const { cloudinaryClient } = await import('../../src/services/cloudinary.service.js');

// Minimal valid byte fixtures
const PNG_FIXTURE = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d400000000049454e44ae426082',
  'hex'
);
const GIF_FIXTURE = Buffer.from(
  '47494638396101000100800000ffffff00000021f90401000000002c000000000100010000020144003b',
  'hex'
);
const JPEG_FIXTURE = Buffer.from(
  'ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffda000c03010002110311003f00bf00ffd9',
  'hex'
);
const WEBP_FIXTURE = Buffer.from(
  '524946461a000000574542505650384c0d0000002f00000010071011118888fe0700',
  'hex'
);
const WAV_FIXTURE = Buffer.from(
  '524946462400000057415645666d7420100000000100010044ac000088580100020010006461746100000000',
  'hex'
);
const MP3_FIXTURE = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(1000, 0)]);
const OGG_FIXTURE = Buffer.concat([
  Buffer.from('4f67675300020000000000000000000000000000000001134f707573486561640102000080bb0000000000', 'hex'),
  Buffer.alloc(100),
]);
const MP4_FIXTURE = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');
const WEBM_FIXTURE = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f,
  0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x42, 0x87, 0x81, 0x02, 0x42, 0x85, 0x81, 0x02,
]);

/**
 * Helper to register an authenticated test user and return a supertest agent
 */
async function createAuthenticatedAgent(email = `media_user_${Date.now()}_${Math.random()}@mindlog.app`) {
  const agent = request.agent(app);
  const registerRes = await agent.post('/api/auth/register').send({
    email,
    password: 'Password123!',
  });
  return { agent, user: registerRes.body.data.user };
}

/**
 * Helper to create an active journal entry
 */
async function createEntry(agent, title = 'Media Test Entry') {
  const res = await agent.post('/api/entries').send({ title });
  return res.body.data.entry;
}

describe('Media Uploads and Deletion Integration Tests', () => {
  let uploadMock;
  let destroyMock;

  before(async () => {
    await User.init();
    await Entry.init();

    // Default mock implementations for Cloudinary client methods
    uploadMock = mock.method(cloudinaryClient, 'uploadFromPath', async (filePath, options) => {
      const publicId = `mock-public-${Math.random().toString(36).substring(2, 10)}`;
      return {
        publicId,
        url: `https://res.cloudinary.com/test_cloud/image/upload/v1234567890/${publicId}.png`,
        resourceType: options.resourceType || 'image',
        bytes: 1024,
      };
    });

    destroyMock = mock.method(cloudinaryClient, 'destroy', async (publicId, resourceType) => {
      return { result: 'ok' };
    });
  });

  after(async () => {
    mock.reset();
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Entry.deleteMany({});
    uploadMock.mock.resetCalls();
    destroyMock.mock.resetCalls();
  });

  afterEach(async () => {
    // HARD CONSTRAINT: Assert temp directory has no leftover files after every request
    if (fs.existsSync(env.mediaTmpDir)) {
      const leftoverFiles = fs.readdirSync(env.mediaTmpDir);
      assert.equal(
        leftoverFiles.length,
        0,
        `Leftover temporary files found in ${env.mediaTmpDir}: ${leftoverFiles.join(', ')}`
      );
    }
  });

  describe('Authentication Requirements', () => {
    it('returns 401 UNAUTHORIZED on POST /:id/media when no cookie is sent', async () => {
      const validObjectId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/entries/${validObjectId}/media`)
        .attach('files', PNG_FIXTURE, 'image.png');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.equal(uploadMock.mock.callCount(), 0);
    });

    it('returns 401 UNAUTHORIZED on DELETE /:id/media/:mediaId when no cookie is sent', async () => {
      const entryId = new mongoose.Types.ObjectId().toString();
      const mediaId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).delete(`/api/entries/${entryId}/media/${mediaId}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
      assert.equal(destroyMock.mock.callCount(), 0);
    });
  });

  describe('Access Control & Ownership Isolation (0 Cloudinary Calls)', () => {
    it('returns 404 NOT_FOUND for an invalid entry ID format with zero Cloudinary calls', async () => {
      const { agent } = await createAuthenticatedAgent();
      const res = await agent
        .post('/api/entries/invalid-id-format/media')
        .attach('files', PNG_FIXTURE, 'test.png');

      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
      assert.equal(res.body.error.message, 'Entry not found');
      assert.equal(uploadMock.mock.callCount(), 0);
    });

    it('returns 404 NOT_FOUND for a nonexistent entry ID with zero Cloudinary calls', async () => {
      const { agent } = await createAuthenticatedAgent();
      const nonexistentId = new mongoose.Types.ObjectId().toString();
      const res = await agent
        .post(`/api/entries/${nonexistentId}/media`)
        .attach('files', PNG_FIXTURE, 'test.png');

      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
      assert.equal(res.body.error.message, 'Entry not found');
      assert.equal(uploadMock.mock.callCount(), 0);
    });

    it('returns 404 NOT_FOUND when User B attempts to upload to User A entry', async () => {
      const userA = await createAuthenticatedAgent('user_a@mindlog.app');
      const userB = await createAuthenticatedAgent('user_b@mindlog.app');
      const entryA = await createEntry(userA.agent, 'User A Entry');

      const res = await userB.agent
        .post(`/api/entries/${entryA.id}/media`)
        .attach('files', PNG_FIXTURE, 'user_b_file.png');

      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
      assert.equal(res.body.error.message, 'Entry not found');
      assert.equal(uploadMock.mock.callCount(), 0);
    });

    it('returns 404 NOT_FOUND when attempting to upload to a trashed entry', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Entry to be trashed');

      // Soft delete (trash) entry
      await agent.patch(`/api/entries/${entry.id}/trash`);

      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', PNG_FIXTURE, 'image.png');

      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
      assert.equal(res.body.error.message, 'Entry not found');
      assert.equal(uploadMock.mock.callCount(), 0);
    });
  });

  describe('Successful Uploads & Response Shape', () => {
    it('uploads a single image, returns 201, conforms strictly to frontend shape, and persists internal fields in DB', async () => {
      const { agent, user } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Vacation Photo');

      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', PNG_FIXTURE, 'sample photo.png');

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);

      const returnedEntry = res.body.data.entry;
      assert.ok(returnedEntry);
      assert.equal(returnedEntry.id, entry.id);
      assert.equal(returnedEntry.media.length, 1);

      const mediaItem = returnedEntry.media[0];
      // Front-end contract check: ONLY id, kind, url, name exposed
      const mediaKeys = Object.keys(mediaItem).sort();
      assert.deepEqual(mediaKeys, ['id', 'kind', 'name', 'url']);
      assert.equal(typeof mediaItem.id, 'string');
      assert.equal(mediaItem.kind, 'image');
      assert.equal(mediaItem.name, 'sample photo.png');
      assert.ok(mediaItem.url.startsWith('https://res.cloudinary.com/'));

      // Crucial: Ensure internal fields NEVER leak in JSON response
      assert.equal(mediaItem.publicId, undefined);
      assert.equal(mediaItem.resourceType, undefined);
      assert.equal(mediaItem.mimeType, undefined);
      assert.equal(mediaItem.sizeBytes, undefined);

      // Verify Cloudinary was called with correct folder and resourceType
      assert.equal(uploadMock.mock.callCount(), 1);
      const [calledPath, calledOptions] = uploadMock.mock.calls[0].arguments;
      assert.equal(calledOptions.folder, `mindlog/${user.id}/${entry.id}`);
      assert.equal(calledOptions.resourceType, 'image');

      // Database verification: Stored Mongoose document DOES contain internal fields
      const dbEntry = await Entry.findById(entry.id);
      assert.equal(dbEntry.media.length, 1);
      const dbMedia = dbEntry.media[0];
      assert.ok(dbMedia.publicId);
      assert.equal(dbMedia.resourceType, 'image');
      assert.equal(dbMedia.mimeType, 'image/png');
      assert.equal(dbMedia.sizeBytes, PNG_FIXTURE.length);
    });

    it('uploads mixed formats (image, audio, video) and classifies resource types properly', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Mixed Media Entry');

      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', JPEG_FIXTURE, 'photo.jpg')
        .attach('files', MP3_FIXTURE, 'recording.mp3')
        .attach('files', MP4_FIXTURE, 'clip.mp4');

      assert.equal(res.status, 201);
      const returnedMedia = res.body.data.entry.media;
      assert.equal(returnedMedia.length, 3);

      assert.equal(returnedMedia[0].kind, 'image');
      assert.equal(returnedMedia[1].kind, 'audio');
      assert.equal(returnedMedia[2].kind, 'video');

      // Cloudinary resource_type check: Audio and Video both upload under resource_type 'video'
      assert.equal(uploadMock.mock.callCount(), 3);
      assert.equal(uploadMock.mock.calls[0].arguments[1].resourceType, 'image');
      assert.equal(uploadMock.mock.calls[1].arguments[1].resourceType, 'video'); // MP3 audio uses video resourceType
      assert.equal(uploadMock.mock.calls[2].arguments[1].resourceType, 'video');
    });
  });

  describe('Byte-Level Detection vs Spoofed Extensions', () => {
    it('classifies a PNG with a spoofed .mp3 extension and claimed audio/mpeg as an image based on content bytes', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Spoofed Extension Test');

      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', PNG_FIXTURE, { filename: 'spoofed.mp3', contentType: 'audio/mpeg' });

      assert.equal(res.status, 201);
      const mediaItem = res.body.data.entry.media[0];
      // Detected bytes are image/png -> classified as image
      assert.equal(mediaItem.kind, 'image');
      assert.equal(mediaItem.name, 'spoofed.mp3');
      assert.equal(uploadMock.mock.calls[0].arguments[1].resourceType, 'image');
    });

    it('rejects a plain text file named .png with claimed image/png with 415 UNSUPPORTED_MEDIA_TYPE (0 Cloudinary calls)', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Fake Image Test');

      const fakeImageBuffer = Buffer.from('this is just a text file disguised as a png');
      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', fakeImageBuffer, { filename: 'fake.png', contentType: 'image/png' });

      assert.equal(res.status, 415);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
      assert.equal(uploadMock.mock.callCount(), 0);
    });

    it('rejects an SVG file with 415 UNSUPPORTED_MEDIA_TYPE due to XSS risk (0 Cloudinary calls)', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'SVG Test');

      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>');
      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', svgBuffer, { filename: 'vector.svg', contentType: 'image/svg+xml' });

      assert.equal(res.status, 415);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
      assert.equal(uploadMock.mock.callCount(), 0);
    });

    it('rejects a file with claimed text/plain MIME type with 415 UNSUPPORTED_MEDIA_TYPE in fileFilter', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Plain Text Test');

      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', Buffer.from('plain notes'), { filename: 'notes.txt', contentType: 'text/plain' });

      assert.equal(res.status, 415);
      assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
      assert.equal(uploadMock.mock.callCount(), 0);
    });
  });

  describe('Size Limits, File Counts & Attachment Caps', () => {
    it('rejects an image exceeding 10 MB with 413 PAYLOAD_TOO_LARGE (0 Cloudinary calls)', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Large Image Test');

      // Valid PNG header padded past 10 MB limit
      const oversizedImage = Buffer.concat([PNG_FIXTURE, Buffer.alloc(10 * 1024 * 1024 + 1024)]);

      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', oversizedImage, 'oversized.png');

      assert.equal(res.status, 413);
      assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
      assert.equal(uploadMock.mock.callCount(), 0);
    });

    it('rejects a request with more than 5 files with 400 BAD_REQUEST (0 Cloudinary calls)', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Too Many Files Test');

      const req = agent.post(`/api/entries/${entry.id}/media`);
      for (let i = 1; i <= 6; i++) {
        req.attach('files', PNG_FIXTURE, `file${i}.png`);
      }

      const res = await req;
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'BAD_REQUEST');
      assert.equal(uploadMock.mock.callCount(), 0);
    });

    it('rejects an upload request with no files attached with 400 BAD_REQUEST (0 Cloudinary calls)', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Empty Upload Test');

      const res = await agent.post(`/api/entries/${entry.id}/media`);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'BAD_REQUEST');
      assert.equal(res.body.error.message, 'No files uploaded');
      assert.equal(uploadMock.mock.callCount(), 0);
    });

    it('rejects a request using a wrong field name with 400 BAD_REQUEST (0 Cloudinary calls)', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Wrong Field Test');

      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('wrongField', PNG_FIXTURE, 'file.png');

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'BAD_REQUEST');
      assert.equal(uploadMock.mock.callCount(), 0);
    });

    it('enforces total attachment cap (max 20 per entry): rejects 2 files on an entry holding 19 with 400', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Capped Entry');

      // Seed entry in DB with 19 mock media subdocuments
      const dummyMedia = Array.from({ length: 19 }, (_, i) => ({
        kind: 'image',
        url: `https://res.cloudinary.com/test/image${i}.png`,
        name: `existing_${i}.png`,
        publicId: `mock-existing-${i}`,
        resourceType: 'image',
        mimeType: 'image/png',
        sizeBytes: 100,
      }));
      await Entry.findByIdAndUpdate(entry.id, { media: dummyMedia });

      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', PNG_FIXTURE, 'extra1.png')
        .attach('files', PNG_FIXTURE, 'extra2.png');

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'BAD_REQUEST');
      assert.equal(res.body.error.message, 'Attachment limit reached (max 20 per entry)');
      assert.equal(uploadMock.mock.callCount(), 0);
    });
  });

  describe('Rollback & Race Condition Compensation', () => {
    it('executes all-or-nothing rollback when Cloudinary fails on the second file: destroys first asset and adds no DB media', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Rollback Test Entry');

      let uploadCount = 0;
      uploadMock.mock.mockImplementation(async (filePath, options) => {
        uploadCount++;
        if (uploadCount === 1) {
          return {
            publicId: 'rollback-asset-1',
            url: 'https://res.cloudinary.com/test/rollback-1.png',
            resourceType: options.resourceType || 'image',
            bytes: 500,
          };
        }
        throw new Error('Cloudinary mock upstream failure');
      });

      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', PNG_FIXTURE, 'file1.png')
        .attach('files', PNG_FIXTURE, 'file2.png')
        .attach('files', PNG_FIXTURE, 'file3.png');

      assert.equal(res.status, 502);
      assert.equal(res.body.error.code, 'UPLOAD_FAILED');
      assert.equal(res.body.error.message, 'Media upload failed');

      // Ensure destroy was called to roll back the first successfully uploaded asset
      assert.equal(destroyMock.mock.callCount(), 1);
      assert.equal(destroyMock.mock.calls[0].arguments[0], 'rollback-asset-1');

      // Verify no media items were added to the database
      const dbEntry = await Entry.findById(entry.id);
      assert.equal(dbEntry.media.length, 0);
    });

    it('compensates race condition: if entry is trashed during upload, destroys uploaded assets and returns 404', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Race Test Entry');

      // Inside upload mock, simulate the entry being soft-deleted concurrently by another process
      uploadMock.mock.mockImplementation(async (filePath, options) => {
        await Entry.findByIdAndUpdate(entry.id, { deletedAt: new Date() });
        return {
          publicId: 'race-uploaded-asset',
          url: 'https://res.cloudinary.com/test/race.png',
          resourceType: 'image',
          bytes: 1000,
        };
      });

      const res = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', PNG_FIXTURE, 'race.png');

      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
      assert.equal(res.body.error.message, 'Entry not found');

      // Destroy must be triggered for the orphaned remote asset
      assert.equal(destroyMock.mock.callCount(), 1);
      assert.equal(destroyMock.mock.calls[0].arguments[0], 'race-uploaded-asset');

      // Verify database entry media remained empty
      const dbEntry = await Entry.findById(entry.id);
      assert.equal(dbEntry.media.length, 0);
    });
  });

  describe('Deleting Media', () => {
    it('removes media attachment from database and calls destroy on Cloudinary with stored publicId', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Entry with Attachment');

      // 1. Upload a media attachment
      const uploadRes = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', PNG_FIXTURE, 'sample.png');

      const mediaId = uploadRes.body.data.entry.media[0].id;
      const dbEntryBefore = await Entry.findById(entry.id);
      const storedPublicId = dbEntryBefore.media[0].publicId;

      destroyMock.mock.resetCalls();

      // 2. Delete the media attachment
      const deleteRes = await agent.delete(`/api/entries/${entry.id}/media/${mediaId}`);

      assert.equal(deleteRes.status, 200);
      assert.equal(deleteRes.body.success, true);
      assert.equal(deleteRes.body.data.entry.media.length, 0);

      // Verify Cloudinary destroy was invoked with stored publicId and resourceType
      assert.equal(destroyMock.mock.callCount(), 1);
      assert.equal(destroyMock.mock.calls[0].arguments[0], storedPublicId);
      assert.equal(destroyMock.mock.calls[0].arguments[1], 'image');

      // Verify database document was updated
      const dbEntryAfter = await Entry.findById(entry.id);
      assert.equal(dbEntryAfter.media.length, 0);
    });

    it('returns 404 NOT_FOUND for invalid mediaId format or nonexistent mediaId', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Entry Test');

      const invalidIdRes = await agent.delete(`/api/entries/${entry.id}/media/invalid-media-id`);
      assert.equal(invalidIdRes.status, 404);
      assert.equal(invalidIdRes.body.error.message, 'Media not found');

      const nonexistentMediaId = new mongoose.Types.ObjectId().toString();
      const notFoundRes = await agent.delete(`/api/entries/${entry.id}/media/${nonexistentMediaId}`);
      assert.equal(notFoundRes.status, 404);
      assert.equal(notFoundRes.body.error.message, 'Media not found');
      assert.equal(destroyMock.mock.callCount(), 0);
    });

    it('returns 404 NOT_FOUND when User B attempts to delete User A media', async () => {
      const userA = await createAuthenticatedAgent('user_a_del@mindlog.app');
      const userB = await createAuthenticatedAgent('user_b_del@mindlog.app');
      const entryA = await createEntry(userA.agent, 'User A Entry');

      const uploadRes = await userA.agent
        .post(`/api/entries/${entryA.id}/media`)
        .attach('files', PNG_FIXTURE, 'a_file.png');

      const mediaId = uploadRes.body.data.entry.media[0].id;
      destroyMock.mock.resetCalls();

      const deleteRes = await userB.agent.delete(`/api/entries/${entryA.id}/media/${mediaId}`);
      assert.equal(deleteRes.status, 404);
      assert.equal(deleteRes.body.error.message, 'Entry not found');
      assert.equal(destroyMock.mock.callCount(), 0);
    });

    it('still succeeds with 200 even if Cloudinary destroy throws (best-effort destruction)', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Best Effort Delete Entry');

      const uploadRes = await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', PNG_FIXTURE, 'test.png');

      const mediaId = uploadRes.body.data.entry.media[0].id;

      // Make destroy fail
      destroyMock.mock.mockImplementation(async () => {
        throw new Error('Cloudinary remote deletion failed');
      });

      const deleteRes = await agent.delete(`/api/entries/${entry.id}/media/${mediaId}`);
      assert.equal(deleteRes.status, 200);
      assert.equal(deleteRes.body.data.entry.media.length, 0);

      // Verify item was still removed from database
      const dbEntry = await Entry.findById(entry.id);
      assert.equal(dbEntry.media.length, 0);
    });
  });

  describe('Permanent Delete & Purge Cleanup Integration', () => {
    it('permanent delete of an entry with media invokes destroy for each media item', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Entry to delete permanently');

      await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', PNG_FIXTURE, 'img1.png')
        .attach('files', GIF_FIXTURE, 'img2.gif');

      destroyMock.mock.resetCalls();

      const deleteRes = await agent.delete(`/api/entries/${entry.id}`);
      assert.equal(deleteRes.status, 200);

      // Both media items must trigger destroy
      assert.equal(destroyMock.mock.callCount(), 2);
    });

    it('soft delete (trashing) an entry calls destroy ZERO times', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Entry to soft delete');

      await agent
        .post(`/api/entries/${entry.id}/media`)
        .attach('files', PNG_FIXTURE, 'img1.png');

      destroyMock.mock.resetCalls();

      const trashRes = await agent.patch(`/api/entries/${entry.id}/trash`);
      assert.equal(trashRes.status, 200);

      assert.equal(destroyMock.mock.callCount(), 0);
    });

    it('purging trash permanently removes entries and destroys all their media items', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry1 = await createEntry(agent, 'Trashed Entry 1');
      const entry2 = await createEntry(agent, 'Trashed Entry 2');

      await agent
        .post(`/api/entries/${entry1.id}/media`)
        .attach('files', PNG_FIXTURE, 'e1.png');
      await agent
        .post(`/api/entries/${entry2.id}/media`)
        .attach('files', GIF_FIXTURE, 'e2.gif');

      // Soft delete both
      await agent.patch(`/api/entries/${entry1.id}/trash`);
      await agent.patch(`/api/entries/${entry2.id}/trash`);

      destroyMock.mock.resetCalls();

      const purgeRes = await agent
        .post('/api/entries/trash/purge')
        .send({ ids: [entry1.id, entry2.id] });

      assert.equal(purgeRes.status, 200);
      assert.equal(purgeRes.body.data.purgedCount, 2);

      // Destroy called once for each attachment across the purged entries
      assert.equal(destroyMock.mock.callCount(), 2);
    });
  });

  describe('Security & Secrets Leak Prevention', () => {
    it('never leaks CLOUDINARY_API_SECRET in any response body or header', async () => {
      const { agent } = await createAuthenticatedAgent();
      const entry = await createEntry(agent, 'Secret Leak Test');

      const requests = [
        // 201 Success
        agent.post(`/api/entries/${entry.id}/media`).attach('files', PNG_FIXTURE, 'test.png'),
        // 400 Bad request
        agent.post(`/api/entries/${entry.id}/media`),
        // 404 Not found
        agent.post('/api/entries/bad-id/media'),
        // 415 Unsupported
        agent.post(`/api/entries/${entry.id}/media`).attach('files', Buffer.from('hello'), 'notes.txt'),
      ];

      for (const reqPromise of requests) {
        const res = await reqPromise;
        const bodyStr = JSON.stringify(res.body || {});
        const headerStr = JSON.stringify(res.headers || {});

        assert.ok(
          !bodyStr.includes(process.env.CLOUDINARY_API_SECRET),
          'Secret detected in response body!'
        );
        assert.ok(
          !headerStr.includes(process.env.CLOUDINARY_API_SECRET),
          'Secret detected in response headers!'
        );
      }
    });
  });
});
