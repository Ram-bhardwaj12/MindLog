import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTitle, sanitizeBody } from '../../src/utils/sanitize.js';

describe('HTML & Title Sanitizer Unit Tests', () => {
  describe('sanitizeBody', () => {
    it('preserves ordinary editor formatting markup produced by contentEditable', () => {
      const input =
        '<b>Bold text</b> <i>Italic text</i> <u>Underlined text</u>' +
        '<div style="text-align: center">Centered line</div>' +
        '<p style="text-align: right">Right-aligned paragraph</p>' +
        '<ul><li>Bullet item 1</li><li>Bullet item 2</li></ul>' +
        '<ol><li>Ordered item 1</li></ol>' +
        '<h1>Heading 1</h1><h2>Heading 2</h2>' +
        '<blockquote>A memorable quote</blockquote>' +
        '<pre><code>const a = 1;</code></pre>' +
        '<s>Strikethrough</s> <strike>Old strike</strike>' +
        '<span>Inline text</span><br />';

      const output = sanitizeBody(input);
      assert.ok(output.includes('<b>Bold text</b>'));
      assert.ok(output.includes('<i>Italic text</i>'));
      assert.ok(output.includes('<u>Underlined text</u>'));
      assert.ok(output.includes('text-align:center') || output.includes('text-align: center'));
      assert.ok(output.includes('<ul><li>Bullet item 1</li>'));
      assert.ok(output.includes('<blockquote>A memorable quote</blockquote>'));
    });

    it('removes <script> and <style> tags WITH their contents', () => {
      const malicious = '<script>alert("xss")</script><style>body { display: none; }</style><p>Safe content</p>';
      const cleaned = sanitizeBody(malicious);

      assert.equal(cleaned, '<p>Safe content</p>');
      assert.ok(!cleaned.includes('alert'));
      assert.ok(!cleaned.includes('script'));
      assert.ok(!cleaned.includes('style'));
    });

    it('removes <iframe>, <object>, and <embed> tags with contents', () => {
      const input = '<iframe src="http://evil.com">frame</iframe><embed src="evil.swf"></embed><p>Valid</p>';
      const cleaned = sanitizeBody(input);
      assert.equal(cleaned, '<p>Valid</p>');
    });

    it('strips disallowed tags but preserves their text contents', () => {
      const input = '<marquee>Scrolling text</marquee><blink>Blinking</blink><article>Article content</article>';
      const cleaned = sanitizeBody(input);
      assert.equal(cleaned, 'Scrolling textBlinkingArticle content');
    });

    it('strips inline event handler attributes like onerror, onload, onclick', () => {
      const input = '<p onclick="alert(1)" onmouseover="steal()">Hello</p>';
      const cleaned = sanitizeBody(input);
      assert.equal(cleaned, '<p>Hello</p>');
      assert.ok(!cleaned.includes('onclick'));
      assert.ok(!cleaned.includes('onmouseover'));
    });

    it('strips images (<img>) and links (<a>) completely', () => {
      const input = '<img src="https://evil.com/x.jpg" onerror="alert(1)" /><a href="https://example.com">Visit</a>';
      const cleaned = sanitizeBody(input);
      assert.equal(cleaned, 'Visit');
      assert.ok(!cleaned.includes('<img'));
      assert.ok(!cleaned.includes('<a'));
    });

    it('strips disallowed CSS style properties while preserving text-align', () => {
      const input =
        '<div style="text-align: center; color: red; font-size: 50px; background: url(javascript:evil)">Styled</div>';
      const cleaned = sanitizeBody(input);
      assert.ok(cleaned.includes('text-align'));
      assert.ok(!cleaned.includes('color'));
      assert.ok(!cleaned.includes('font-size'));
      assert.ok(!cleaned.includes('javascript'));
    });

    it('is strictly idempotent: sanitize(sanitize(x)) === sanitize(x)', () => {
      const samples = [
        '<p style="text-align: justify">Paragraph</p>',
        '<b>Bold</b> and <i>Italic</i>',
        '<script>bad()</script><div>Hello world</div>',
        '<ul><li>List A</li><li>List B</li></ul>',
      ];

      for (const sample of samples) {
        const firstPass = sanitizeBody(sample);
        const secondPass = sanitizeBody(firstPass);
        assert.equal(firstPass, secondPass);
      }
    });

    it('handles null, undefined, and empty string safely', () => {
      assert.equal(sanitizeBody(null), '');
      assert.equal(sanitizeBody(undefined), '');
      assert.equal(sanitizeBody(''), '');
    });
  });

  describe('sanitizeTitle (Part B Bug Fix & Hardening)', () => {
    it('preserves literal entity strings without decoding them into tags', () => {
      // &lt;b&gt; must stay &lt;b&gt;, NOT decode into <b>
      assert.equal(sanitizeTitle('&lt;b&gt;'), '&lt;b&gt;');

      // &amp; must stay &amp;, NOT decode into &
      assert.equal(sanitizeTitle('&amp;'), '&amp;');

      // a &amp b
      assert.equal(sanitizeTitle('a &amp b'), 'a &amp b');
    });

    it('preserves plain text containing & or comparison brackets or quotes exactly as typed', () => {
      // Tom & Jerry
      assert.equal(sanitizeTitle('Tom & Jerry'), 'Tom & Jerry');

      // 5 < 6 > 4
      assert.equal(sanitizeTitle('5 < 6 > 4'), '5 < 6 > 4');

      // "quotes" and 'apostrophes'
      assert.equal(sanitizeTitle('"quotes"'), '"quotes"');
      assert.equal(sanitizeTitle('"quotes" and \'apostrophes\''), '"quotes" and \'apostrophes\'');
    });

    it('safely strips real HTML tags and dangerous elements with their contents', () => {
      // <b>bold</b> title -> bold title
      assert.equal(sanitizeTitle('<b>bold</b> title'), 'bold title');

      // <script>alert(1)</script>Hi -> Hi
      assert.equal(sanitizeTitle('<script>alert(1)</script>Hi'), 'Hi');

      // <style>body{color:red}</style>Content -> Content
      assert.equal(sanitizeTitle('<style>body{color:red}</style>Content'), 'Content');

      // Nested or interleaved tags: <<SCRIPT>alert(1)//<</SCRIPT>Clean -> Clean or safe
      const nested = sanitizeTitle('<<SCRIPT>alert(1)//<</SCRIPT>Clean');
      assert.ok(!nested.includes('alert'));
      assert.ok(!nested.includes('SCRIPT'));
    });

    it('is strictly idempotent for all canonical and edge cases: sanitizeTitle(sanitizeTitle(x)) === sanitizeTitle(x)', () => {
      const testInputs = [
        '&lt;b&gt;',
        '&amp;',
        'Tom & Jerry',
        '5 < 6 > 4',
        '"quotes"',
        'a &amp b',
        '<b>bold</b> title',
        '<script>alert(1)</script>Hi',
        '<style>body{color:red}</style>Content',
        'Simple Title',
        '   Padded   Whitespace   Title   ',
      ];

      for (const input of testInputs) {
        const pass1 = sanitizeTitle(input);
        const pass2 = sanitizeTitle(pass1);
        assert.equal(
          pass2,
          pass1,
          `Failed idempotence for input: "${input}" (pass1="${pass1}", pass2="${pass2}")`
        );
      }
    });

    it('collapses control characters and multiline whitespaces into a single space', () => {
      const raw = 'First Line\r\n\tSecond Line\x00\x1f   Third Line  ';
      const cleaned = sanitizeTitle(raw);
      assert.equal(cleaned, 'First Line Second Line Third Line');
    });

    it('handles null, undefined, and empty string safely', () => {
      assert.equal(sanitizeTitle(null), '');
      assert.equal(sanitizeTitle(undefined), '');
      assert.equal(sanitizeTitle(''), '');
    });
  });
});
