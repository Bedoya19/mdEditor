/**
 * @file inlineRules.js
 * The catalogue of INLINE Markdown syntax (bold, links, code spans…).
 *
 * DESIGN — Strategy objects + Open/Closed principle
 * Each rule is a plain object `{ name, pattern, render }`. The InlineRenderer
 * just loops over the list; it knows nothing about any specific syntax.
 * To support new syntax (e.g. ==highlight==) you ADD a rule here — you never
 * modify the renderer. That is the "O" in SOLID.
 *
 * ORDER MATTERS
 * Rules run top-to-bottom on already-escaped text:
 *   1. backslash escapes & code spans first, so their content is "frozen";
 *   2. images before links (an image is a link with a leading "!");
 *   3. bold (`**`) before italic (`*`) so `**x**` isn't read as two italics.
 *
 * `ctx.protect(html)` stores finished HTML and returns a placeholder token,
 * so later rules can't accidentally re-process it (e.g. an underscore inside
 * a URL being turned into <em>).
 *
 * @typedef {Object} InlineContext
 * @property {(html: string) => string} protect  Freeze HTML from later rules.
 * @property {(escapedText: string) => string} render Recursively render nested text.
 *
 * @typedef {Object} InlineRule
 * @property {string} name
 * @property {RegExp} pattern   Must be global (/g).
 * @property {(match: string[], ctx: InlineContext) => string} render
 */

import { sanitizeUrl } from './htmlUtils.js';

/** Builds an optional ` title="…"` attribute. Title text is already escaped. */
const titleAttr = (title) => (title ? ` title="${title}"` : '');

/** @type {InlineRule[]} */
export const defaultInlineRules = [
  {
    // \* \_ \# … → the literal character, untouched by later rules.
    name: 'backslashEscape',
    pattern: /\\([\\`*_{}\[\]()#+\-.!~|])/g,
    render: ([, ch], { protect }) => protect(ch),
  },
  {
    // `code` — content is shown verbatim (it is already HTML-escaped).
    name: 'codeSpan',
    pattern: /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g,
    render: ([, , code], { protect }) => protect(`<code>${code.trim()}</code>`),
  },
  {
    // ![alt](src "title")
    name: 'image',
    pattern: /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g,
    render: ([, alt, src, title], { protect }) =>
      protect(`<img src="${sanitizeUrl(src)}" alt="${alt}"${titleAttr(title)} loading="lazy">`),
  },
  {
    // [text](href "title") — link text may itself contain formatting.
    name: 'link',
    pattern: /\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g,
    render: ([, text, href, title], { protect, render }) => {
      const safe = sanitizeUrl(href);
      const external = /^https?:/i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return protect(`<a href="${safe}"${titleAttr(title)}${external}>${render(text)}</a>`);
    },
  },
  {
    // <https://example.com> — note "<" and ">" are already escaped.
    name: 'autolink',
    pattern: /&lt;((?:https?:\/\/|mailto:)[^\s]+?)&gt;/g,
    render: ([, url], { protect }) =>
      protect(`<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`),
  },
  {
    // The closing marker may not be followed by another "*", so that
    // ***both*** becomes <strong><em>both</em></strong> (properly nested).
    name: 'bold',
    pattern: /(\*\*|__)(?=\S)([\s\S]*?\S)\1(?!\*)/g,
    render: ([, , text], { render }) => `<strong>${render(text)}</strong>`,
  },
  {
    name: 'italicStar',
    pattern: /\*(?=\S)([^*]*?\S)\*/g,
    render: ([, text], { render }) => `<em>${render(text)}</em>`,
  },
  {
    // Underscores only count at word boundaries so snake_case_names survive.
    name: 'italicUnderscore',
    pattern: /(^|[^\p{L}\p{N}_])_(?=\S)([^_]*?\S)_(?![\p{L}\p{N}_])/gu,
    render: ([, before, text], { render }) => `${before}<em>${render(text)}</em>`,
  },
  {
    name: 'strikethrough',
    pattern: /~~(?=\S)([\s\S]*?\S)~~/g,
    render: ([, text], { render }) => `<del>${render(text)}</del>`,
  },
  {
    // Two+ trailing spaces or a trailing backslash = hard line break.
    name: 'hardBreak',
    pattern: /(?: {2,}|\\)\n/g,
    render: () => '<br>\n',
  },
];
