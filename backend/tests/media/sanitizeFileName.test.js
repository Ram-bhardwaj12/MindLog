import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFileName } from '../../src/utils/sanitizeFileName.js';

describe('Filename Sanitizer Unit Tests', () => {
  it('strips path traversal patterns and returns basename only', () => {
    assert.equal(sanitizeFileName('../../etc/passwd.png'), 'passwd.png');
    assert.equal(sanitizeFileName('..\\..\\windows\\system32\\calc.exe'), 'calc.exe');
    assert.equal(sanitizeFileName('/var/log/app.log'), 'app.log');
    assert.equal(sanitizeFileName('folder/subfolder/image.webp'), 'image.webp');
  });

  it('removes non-printable ASCII control characters', () => {
    const malicious = 'bad\x00file\x1f\x07name.png';
    assert.equal(sanitizeFileName(malicious), 'badfilename.png');
  });

  it('preserves literal characters without HTML-entity encoding', () => {
    assert.equal(sanitizeFileName('Tom & Jerry.jpg'), 'Tom & Jerry.jpg');
    assert.equal(sanitizeFileName('Report "Q1" <Draft>.pdf'), 'Report "Q1" <Draft>.pdf');
    assert.equal(sanitizeFileName("Sam's Photo.png"), "Sam's Photo.png");
  });

  it('collapses consecutive whitespace and trims ends', () => {
    assert.equal(sanitizeFileName('   my   photo   file.png   '), 'my photo file.png');
  });

  it('truncates very long names while strictly preserving the extension', () => {
    const longBase = 'a'.repeat(200);
    const result = sanitizeFileName(`${longBase}.png`);
    assert.equal(result.length, 120);
    assert.ok(result.endsWith('.png'));
    assert.equal(result, 'a'.repeat(116) + '.png');
  });

  it('handles long names without extension by truncating to 120 characters', () => {
    const longBase = 'b'.repeat(150);
    const result = sanitizeFileName(longBase);
    assert.equal(result.length, 120);
    assert.equal(result, 'b'.repeat(120));
  });

  it('falls back to "file" for empty or invalid inputs', () => {
    assert.equal(sanitizeFileName(''), 'file');
    assert.equal(sanitizeFileName('   '), 'file');
    assert.equal(sanitizeFileName(null), 'file');
    assert.equal(sanitizeFileName(undefined), 'file');
    assert.equal(sanitizeFileName(123), 'file');
    assert.equal(sanitizeFileName('.'), 'file');
    assert.equal(sanitizeFileName('..'), 'file');
    assert.equal(sanitizeFileName('../../'), 'file');
  });
});

