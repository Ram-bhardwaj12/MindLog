/**
 * HTML Sanitization Utilities for MindLog.
 *
 * Uses `sanitize-html` with an explicit allow-list derived from:
 * 1. The markup produced by the contentEditable editor (document.execCommand):
 *    - <b>, <strong> (Bold)
 *    - <i>, <em> (Italic)
 *    - <u> (Underline)
 *    - <div style="text-align: left|center|right|justify">, <p align="..."> (Alignment)
 *    - <ul>, <ol>, <li> (Lists)
 *    - <br>, <div>, <p> (Line and paragraph breaks)
 * 2. Safe formatting from normal paste (Word, Docs, Markdown):
 *    - <h1> through <h6> (Headings)
 *    - <blockquote>, <pre>, <code> (Quotes and code snippets)
 *    - <s>, <strike> (Strikethrough)
 *    - <span> (Inline styling wrappers with text-align only)
 *
 * Disallowed tags are stripped but their text content is preserved.
 * <script>, <style>, <iframe>, <object>, <embed> are removed WITH their contents.
 * No links (<a>), images (<img>), or inline event handlers are permitted.
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Configuration options for bodyHtml sanitization.
 */
export const BODY_SANITIZE_OPTIONS = {
  // Explicitly permitted tags
  allowedTags: [
    'p',
    'div',
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    's',
    'strike',
    'ul',
    'ol',
    'li',
    'span',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'code',
  ],

  // Permitted attributes per tag (strictly limited to layout alignment)
  allowedAttributes: {
    div: ['style', 'align'],
    p: ['style', 'align'],
    span: ['style'],
    h1: ['style', 'align'],
    h2: ['style', 'align'],
    h3: ['style', 'align'],
    h4: ['style', 'align'],
    h5: ['style', 'align'],
    h6: ['style', 'align'],
    blockquote: ['style', 'align'],
  },

  // Strictly permit ONLY text-align style property
  allowedStyles: {
    '*': {
      'text-align': [/^(?:left|right|center|justify)$/i],
    },
  },

  // Tags removed WITH their contents (prevents malicious payload leakage)
  nonTextTags: [
    'style',
    'script',
    'textarea',
    'option',
    'noscript',
    'iframe',
    'object',
    'embed',
    'applet',
  ],

  // Links are not created by the editor; disallow all protocols
  allowedSchemes: [],
  allowedSchemesByTag: {},

  // Do not automatically wrap the output in any container tag
  enforceHtmlBoundary: false,
};

/**
 * Sanitizes an entry body HTML string.
 *
 * @param {string|unknown} rawHtml - Unsanitized HTML string
 * @returns {string} Clean, safe HTML string
 */
export function sanitizeBody(rawHtml) {
  if (rawHtml === null || rawHtml === undefined) {
    return '';
  }
  const stringValue = typeof rawHtml === 'string' ? rawHtml : String(rawHtml);
  return sanitizeHtml(stringValue, BODY_SANITIZE_OPTIONS);
}

/**
 * Helper to decode HTML entities in plain text strings.
 *
 * @param {string} str
 * @returns {string}
 */
export function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Sanitizes an entry title without round-tripping through HTML entity encoding.
 *
 * THE BUG IN PREVIOUS VERSIONS (Phase 8 Part B):
 * Previously, sanitizeHtml(title, { allowedTags: [] }) stripped tags but simultaneously
 * escaped characters like '&' into '&amp;'. To compensate, decodeHtmlEntities was run.
 * However, this caused literal entities typed by the user (such as '&lt;b&gt;' or '&amp;')
 * to be prematurely decoded into '<b>' or '&'. On a subsequent edit/save, the resulting
 * '<b>' was stripped as an actual HTML tag, violating idempotence and corrupting user data.
 *
 * THE DEFENSIVE APPROACH:
 * Titles are rendered by React as plain text DOM children (e.g. <h2>{entry.title}</h2>),
 * which natively and safely escapes all characters. Thus, titles should never undergo
 * HTML entity encoding or decoding round-trips. We strip dangerous elements (<script>,
 * <style>, <iframe>, etc.) along with their contents, strip real HTML tags (matching
 * tag names beginning with an ASCII letter), and collapse control characters and whitespace.
 *
 * Guarantees:
 * 1. Plain text and literal entities (e.g. '&lt;b&gt;', '&amp;', 'Tom & Jerry', '5 < 6 > 4',
 *    '"quotes"', 'a &amp b') are stored exactly as typed.
 * 2. Real HTML tags (e.g. '<b>bold</b>', '<script>alert(1)</script>') are safely stripped.
 * 3. Idempotence holds strictly: sanitizeTitle(sanitizeTitle(x)) === sanitizeTitle(x).
 *
 * @param {string|unknown} rawTitle - Raw title string
 * @returns {string} Clean plain text title
 */
export function sanitizeTitle(rawTitle) {
  if (rawTitle === null || rawTitle === undefined) {
    return '';
  }
  let str = typeof rawTitle === 'string' ? rawTitle : String(rawTitle);

  // 1. Remove dangerous elements with their entire inner content
  const nonTextTags = ['script', 'style', 'iframe', 'textarea', 'option', 'noscript', 'object', 'embed'];
  for (const tag of nonTextTags) {
    const re = new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>', 'gi');
    str = str.replace(re, '');
    const selfClosing = new RegExp('<' + tag + '\\b[^>]*\\/?>', 'gi');
    str = str.replace(selfClosing, '');
  }

  // 2. Strip HTML tags without altering HTML entities or plain text
  // Loop handles nested or interleaved tag attempts
  let prev;
  do {
    prev = str;
    str = str.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g, '');
  } while (str !== prev);

  // 3. Collapse control characters (newlines, tabs, null bytes) and whitespace, and trim
  return str.replace(/[\x00-\x1f\x7f-\x9f\s]+/g, ' ').trim();
}
