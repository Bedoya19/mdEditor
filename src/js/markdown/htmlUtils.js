/**
 * @file htmlUtils.js
 * Small, pure helpers shared by the Markdown engine.
 *
 * WHY A SEPARATE MODULE?
 * Escaping and URL sanitising are *security* concerns. Keeping them in one
 * tiny file makes them easy to audit and lets every rule reuse the exact same
 * logic instead of re-implementing it (and getting it subtly wrong).
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes the five HTML-significant characters.
 * Every piece of user text goes through this BEFORE any Markdown syntax is
 * turned into tags, so a Markdown file can never inject raw HTML/JS into the
 * preview.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Protocols we consider safe inside href/src attributes. */
const SAFE_PROTOCOL = /^(https?:|mailto:|tel:|#|\/|\.{0,2}\/|[^:]*$)/i;

/**
 * Returns the URL if it is safe to place in an attribute, or "#" otherwise.
 * Blocks `javascript:`, `data:`, `vbscript:` … — anything with a scheme that
 * is not explicitly allowed. Relative paths (no scheme) are allowed so local
 * images next to the .md file keep working.
 *
 * The input is expected to be already HTML-escaped (rules run on escaped
 * text), so we decode `&amp;` only for the protocol check.
 * @param {string} url
 * @returns {string}
 */
export function sanitizeUrl(url) {
  const trimmed = String(url).trim();
  const decoded = trimmed.replace(/&amp;/g, '&').replace(/[\u0000-\u001F\s]/g, '');
  return SAFE_PROTOCOL.test(decoded) ? trimmed : '#';
}

/**
 * Turns heading text into a URL-friendly id ("Hello World!" → "hello-world")
 * so headings can be linked to with `[jump](#hello-world)`.
 * @param {string} text Plain or HTML text (tags are stripped).
 * @returns {string}
 */
export function slugify(text) {
  return String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}
