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
 * sanitize-html escapes characters like &, <, >, ", ' by default.
 * Titles are rendered by React directly as text (never via innerHTML),
 * so they must remain in unescaped plain text form to avoid double escaping.
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
 * Sanitizes an entry title.
 * Since Step 0 confirmed title is plain text from an <input> and rendered
 * without dangerouslySetInnerHTML, all HTML tags are stripped, control
 * characters collapsed, and whitespace trimmed.
 *
 * NOTE: The result is decoded so characters like '&' or quotes are not
 * stored as '&amp;' or '&quot;' (React automatically escapes plain text on render).
 *
 * @param {string|unknown} rawTitle - Raw title string
 * @returns {string} Clean plain text title
 */
export function sanitizeTitle(rawTitle) {
  if (rawTitle === null || rawTitle === undefined) {
    return '';
  }
  const stringValue = typeof rawTitle === 'string' ? rawTitle : String(rawTitle);

  // Strip all HTML tags
  const stripped = sanitizeHtml(stringValue, {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe'],
  });

  // Decode HTML entities back to plain text
  const decoded = decodeHtmlEntities(stripped);

  // Collapse control characters (newlines, tabs, null bytes) and whitespace
  return decoded.replace(/[\x00-\x1f\x7f-\x9f\s]+/g, ' ').trim();
}

