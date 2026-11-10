import path from 'node:path';

/**
 * Sanitizes an uploaded file's original name before persisting it to the database.
 *
 * Rules:
 * - Extracts plain basename only (stripping POSIX and Windows directory traversal paths)
 * - Strips non-printable ASCII control characters
 * - Collapses consecutive whitespace into a single space and trims
 * - Preserves literal characters without HTML-entity encoding (React escapes safely at render time)
 * - Limits total length to 120 characters while preserving the file extension
 * - Falls back to 'file' if the result is empty or invalid
 *
 * @param {string} [name] - Original filename from client
 * @returns {string} Sanitized filename
 */
export function sanitizeFileName(name) {
  if (typeof name !== 'string') {
    return 'file';
  }

  // 1. Strip directory traversal paths (support both / and \)
  let basename = name.replace(/^.*[\\/]/, '');

  // 2. Strip non-printable control characters
  basename = basename.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // 3. Collapse whitespace and trim
  basename = basename.replace(/\s+/g, ' ').trim();

  if (!basename || basename === '.' || basename === '..') {
    return 'file';
  }

  // 4. Truncate to maximum 120 characters while preserving file extension
  const MAX_LENGTH = 120;
  if (basename.length > MAX_LENGTH) {
    const ext = path.extname(basename); // includes the dot, e.g. '.png'
    if (ext && ext.length < MAX_LENGTH) {
      const baseWithoutExt = basename.slice(0, basename.length - ext.length);
      const allowedBaseLength = Math.max(1, MAX_LENGTH - ext.length);
      basename = baseWithoutExt.slice(0, allowedBaseLength) + ext;
    } else {
      basename = basename.slice(0, MAX_LENGTH);
    }
  }

  return basename || 'file';
}

