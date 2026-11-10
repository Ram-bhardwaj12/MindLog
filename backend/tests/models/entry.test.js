import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Entry from '../../src/models/Entry.js';

describe('Entry Model Tests (No Database Required)', () => {
  const validUserId = new mongoose.Types.ObjectId();

  it('assigns correct default values for title, bodyHtml, bookmarked, and deletedAt', () => {
    const entry = new Entry({ userId: validUserId });

    assert.equal(entry.title, 'Untitled entry');
    assert.equal(entry.bodyHtml, '');
    assert.equal(entry.bookmarked, false);
    assert.equal(entry.deletedAt, null);
    assert.deepEqual(entry.media, []);
    assert.equal(entry.mood, undefined);
    assert.equal(entry.titleFontStyle, undefined);
    assert.equal(entry.fontStyle, undefined);
    assert.equal(entry.fontSize, undefined);
    assert.equal(entry.lineHeight, undefined);
  });

  it('requires userId to be valid', () => {
    const entry = new Entry({});
    const error = entry.validateSync();

    assert.ok(error);
    assert.ok(error.errors.userId);
  });

  it('rejects titles exceeding 200 characters', () => {
    const entry = new Entry({
      userId: validUserId,
      title: 'T'.repeat(201),
    });

    const error = entry.validateSync();
    assert.ok(error);
    assert.ok(error.errors.title);
  });

  it('rejects invalid fontSize and lineHeight values', () => {
    const entry = new Entry({
      userId: validUserId,
      fontSize: 'extra-gigantic',
      lineHeight: 'super-wide',
    });

    const error = entry.validateSync();
    assert.ok(error);
    assert.ok(error.errors.fontSize);
    assert.ok(error.errors.lineHeight);
  });

  it('rejects invalid media kind in embedded media subdocuments', () => {
    const entry = new Entry({
      userId: validUserId,
      media: [
        {
          kind: 'podcast', // invalid
          url: 'https://example.com/audio.mp3',
          publicId: 'mindlog/audio/123',
        },
      ],
    });

    const error = entry.validateSync();
    assert.ok(error);
    assert.ok(error.errors['media.0.kind']);
  });

  it('preserves an explicitly supplied createdAt on creation (back-dating)', () => {
    const backDated = new Date('2024-03-15T10:30:00.000Z');
    const entry = new Entry({
      userId: validUserId,
      title: 'Spring Day Memory',
      createdAt: backDated,
    });

    assert.equal(entry.createdAt.toISOString(), backDated.toISOString());
  });

  it('declares compound index { userId: 1, deletedAt: 1, createdAt: -1 } in schema indexes', () => {
    const indexes = Entry.schema.indexes();
    const hasCompound = indexes.some(([fields]) => {
      return fields.userId === 1 && fields.deletedAt === 1 && fields.createdAt === -1;
    });

    assert.ok(
      hasCompound,
      'Expected compound index { userId: 1, deletedAt: 1, createdAt: -1 } in Entry schema'
    );
  });

  it('toJSON() transforms output to match JournalEntry contract exactly', () => {
    const entry = new Entry({
      userId: validUserId,
      title: 'Garden Reflections',
      bodyHtml: '<p>Gentle rain on the patio.</p>',
      mood: '🌿 Calm',
      titleFontStyle: 'display',
      fontStyle: 'journal',
      fontSize: 'base',
      lineHeight: 'relaxed',
      bookmarked: true,
      media: [
        {
          kind: 'image',
          url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          name: 'garden.jpg',
          publicId: 'sample_id_123',
          resourceType: 'image',
          mimeType: 'image/jpeg',
          sizeBytes: 1048576,
        },
      ],
    });

    const json = entry.toJSON();

    // Verify string id and removal of MongoDB internal fields
    assert.equal(typeof json.id, 'string');
    assert.equal(json._id, undefined);
    assert.equal(json.__v, undefined);
    assert.equal(json.userId, undefined);

    // Verify fields
    assert.equal(json.title, 'Garden Reflections');
    assert.equal(json.bodyHtml, '<p>Gentle rain on the patio.</p>');
    assert.equal(json.mood, '🌿 Calm');
    assert.equal(json.titleFontStyle, 'display');
    assert.equal(json.fontStyle, 'journal');
    assert.equal(json.fontSize, 'base');
    assert.equal(json.lineHeight, 'relaxed');
    assert.equal(json.bookmarked, true);

    // deletedAt was null, so it must be omitted
    assert.equal(json.deletedAt, undefined);

    // Verify media items contain ONLY { id, kind, url, name }
    assert.equal(json.media.length, 1);
    const mediaItem = json.media[0];
    assert.equal(typeof mediaItem.id, 'string');
    assert.equal(mediaItem.kind, 'image');
    assert.equal(mediaItem.url, 'https://res.cloudinary.com/demo/image/upload/sample.jpg');
    assert.equal(mediaItem.name, 'garden.jpg');
    assert.equal(mediaItem.publicId, undefined);
    assert.equal(mediaItem.resourceType, undefined);
    assert.equal(mediaItem.mimeType, undefined);
    assert.equal(mediaItem.sizeBytes, undefined);
    assert.equal(mediaItem._id, undefined);
  });

  it('toJSON() omits optional fields when unset (mood, font fields, deletedAt)', () => {
    const entry = new Entry({
      userId: validUserId,
      title: 'Bare Minimum Entry',
    });

    const json = entry.toJSON();

    assert.equal('mood' in json, false);
    assert.equal('titleFontStyle' in json, false);
    assert.equal('fontStyle' in json, false);
    assert.equal('fontSize' in json, false);
    assert.equal('lineHeight' in json, false);
    assert.equal('deletedAt' in json, false);
  });
});

