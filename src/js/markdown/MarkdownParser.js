/**
 * @file MarkdownParser.js
 * Converts a Markdown string into an HTML string.
 *
 * WHY WRITE OUR OWN PARSER (instead of using marked / markdown-it)?
 *  - Zero dependencies → works offline and inside a desktop shell untouched.
 *  - It's small and readable: a learning-friendly codebase was a requirement.
 *  - Safe by construction: raw HTML in the source is always escaped.
 * If full CommonMark compliance is ever needed, any object exposing
 * `parse(markdown) → html` can replace this class (see index.js). Nothing
 * else in the app depends on how parsing is done (Dependency Inversion).
 *
 * HOW IT WORKS
 *   1. Normalise line endings and tabs, strip YAML front matter.
 *   2. Walk the lines; at each line ask the block rules (in priority order)
 *      "do you start here?". The first that says yes consumes its lines.
 *   3. Block rules call `inline()` for text and `parseLines()` to recurse
 *      (blockquotes and list items contain other blocks).
 *
 * Supported: headings (ATX + setext), paragraphs, emphasis, strong,
 * strikethrough, inline code, fenced & indented code, blockquotes, nested
 * ordered/unordered/task lists, tables, links, images, autolinks, hard breaks,
 * horizontal rules. Not supported (by design): raw HTML, reference-style links,
 * footnotes.
 */

import { defaultBlockRules } from './blockRules.js';
import { InlineRenderer } from './InlineRenderer.js';
import { escapeHtml } from './htmlUtils.js';

const FRONT_MATTER = /^---\n([\s\S]*?)\n(?:---|\.\.\.)\n?/;

export class MarkdownParser {
  /**
   * @param {Object} [deps]
   * @param {import('./blockRules.js').BlockRule[]} [deps.blockRules]
   * @param {{render(text: string): string}} [deps.inlineRenderer]
   */
  constructor({ blockRules = defaultBlockRules, inlineRenderer = new InlineRenderer() } = {}) {
    this.blockRules = blockRules;
    this.inlineRenderer = inlineRenderer;
    this.interrupters = blockRules.filter((rule) => rule.interruptsParagraph);
  }

  /**
   * Public entry point.
   * @param {string} markdown
   * @returns {string} HTML
   */
  parse(markdown) {
    let source = String(markdown ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, '    ');

    // YAML front matter is metadata, not content: show it discreetly.
    let preamble = '';
    const front = FRONT_MATTER.exec(source);
    if (front) {
      preamble = `<pre class="front-matter"><code>${escapeHtml(front[1])}</code></pre>\n`;
      source = source.slice(front[0].length);
    }

    return preamble + this.parseLines(source.split('\n'));
  }

  /**
   * Parses an array of lines into block HTML. Exposed to rules for recursion.
   * @param {string[]} lines
   * @param {import('./blockRules.js').ParseOptions} [options]
   * @returns {string}
   */
  parseLines(lines, options = {}) {
    const output = [];
    let i = 0;
    while (i < lines.length) {
      if (lines[i].trim() === '') { i++; continue; }

      const rule = this.blockRules.find((r) => r.test(lines, i));
      const { html, next } = rule.consume(lines, i, this, options);
      output.push(html);
      i = Math.max(next, i + 1); // safety net: always make progress
    }
    return output.join('\n');
  }

  /** Renders inline Markdown (used by rules). */
  inline(text) {
    return this.inlineRenderer.render(text);
  }

  /** True if a paragraph-interrupting block starts at line `i`. */
  startsNewBlock(lines, i) {
    return this.interrupters.some((rule) => rule.test(lines, i));
  }
}
