/**
 * @file blockRules.js
 * The catalogue of BLOCK-level Markdown syntax (headings, lists, tables…).
 *
 * DESIGN — same Strategy / Open-Closed idea as inlineRules.js.
 * Every rule implements this small contract:
 *
 * @typedef {Object} BlockRule
 * @property {string}  name
 * @property {boolean} interruptsParagraph  Can this block start right after a
 *           paragraph line without a blank line in between? (e.g. a heading can,
 *           an indented code block can't — it would be ambiguous.)
 * @property {(lines: string[], i: number) => boolean} test
 *           Does a block of this kind start at line `i`?
 * @property {(lines: string[], i: number, parser: BlockParserApi, options: ParseOptions)
 *           => {html: string, next: number}} consume
 *           Read the block, return its HTML and the index of the first line
 *           AFTER the block.
 *
 * @typedef {Object} BlockParserApi  What rules may ask of the parser (Interface
 *           Segregation: rules get only these three methods, not the whole class).
 * @property {(lines: string[], options?: ParseOptions) => string} parseLines  Recurse.
 * @property {(text: string) => string} inline  Render inline Markdown.
 * @property {(lines: string[], i: number) => boolean} startsNewBlock
 *
 * @typedef {Object} ParseOptions
 * @property {boolean} [tight]  Inside a "tight" list paragraphs aren't wrapped in <p>.
 *
 * The ORDER of the exported array is the matching priority.
 */

import { escapeHtml, slugify } from './htmlUtils.js';
import { TABLE_DELIMITER, splitRow, parseAlign } from './tableSyntax.js';

/* ───────────────────────── helpers ───────────────────────── */

const isBlank = (line) => line === undefined || line.trim() === '';
const indentOf = (line) => line.match(/^ */)[0].length;

/* ───────────────────────── rules ───────────────────────── */

/** ``` or ~~~ fenced code, with optional language: ```js */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
export const fencedCode = {
  name: 'fencedCode',
  interruptsParagraph: true,
  test: (lines, i) => FENCE_OPEN.test(lines[i]),
  consume(lines, start) {
    const [, fence, lang] = FENCE_OPEN.exec(lines[start]);
    const closing = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`);
    const body = [];
    let i = start + 1;
    while (i < lines.length && !closing.test(lines[i])) body.push(lines[i++]);
    const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    return {
      html: `<pre><code${langClass}>${escapeHtml(body.join('\n'))}</code></pre>`,
      next: Math.min(i + 1, lines.length), // skip the closing fence (if any)
    };
  },
};

/** # ATX headings (one to six #). */
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
export const heading = {
  name: 'heading',
  interruptsParagraph: true,
  test: (lines, i) => ATX.test(lines[i]),
  consume(lines, i, parser) {
    const [, hashes, text = ''] = ATX.exec(lines[i]);
    const html = parser.inline(text);
    const level = hashes.length;
    return { html: `<h${level} id="${slugify(html)}">${html}</h${level}>`, next: i + 1 };
  },
};

/** --- *** ___ (must be tested BEFORE lists, "* * *" also looks like a list). */
const HR = /^ {0,3}([-*_])( *\1){2,} *$/;
export const horizontalRule = {
  name: 'horizontalRule',
  interruptsParagraph: true,
  test: (lines, i) => HR.test(lines[i]),
  consume: (lines, i) => ({ html: '<hr>', next: i + 1 }),
};

/** > quotes. Content is parsed recursively, so quotes can hold lists, code… */
const QUOTE = /^ {0,3}> ?/;
export const blockquote = {
  name: 'blockquote',
  interruptsParagraph: true,
  test: (lines, i) => QUOTE.test(lines[i]),
  consume(lines, start, parser) {
    const inner = [];
    let i = start;
    while (i < lines.length) {
      if (QUOTE.test(lines[i])) {
        inner.push(lines[i].replace(QUOTE, ''));
      } else if (!isBlank(lines[i]) && !isBlank(inner.at(-1)) && !parser.startsNewBlock(lines, i)) {
        inner.push(lines[i]); // "lazy" continuation line of a quoted paragraph
      } else {
        break;
      }
      i++;
    }
    return { html: `<blockquote>\n${parser.parseLines(inner)}\n</blockquote>`, next: i };
  },
};

/**
 * - bullet, 1. ordered, - [ ] task lists, with nesting by indentation.
 * A list is "loose" (items wrapped in <p>) when items are separated by blank
 * lines, "tight" otherwise — same behaviour as GitHub.
 */
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])(?: +(.*)|$)/;
const TASK = /^\[([ xX])\] +/;
export const list = {
  name: 'list',
  interruptsParagraph: true,
  test: (lines, i) => LIST_ITEM.test(lines[i]),
  consume(lines, start, parser) {
    const first = LIST_ITEM.exec(lines[start]);
    const baseIndent = first[1].length;
    const ordered = /\d/.test(first[2]);
    const items = [];
    let loose = false;
    let sawBlank = false;
    let i = start;

    while (i < lines.length) {
      const line = lines[i];
      const marker = LIST_ITEM.exec(line);
      const isSibling = marker
        && marker[1].length < baseIndent + 2
        && /\d/.test(marker[2]) === ordered;

      if (isSibling) {
        if (sawBlank) loose = true;
        items.push({ lines: [marker[3] ?? ''], contentIndent: marker[1].length + marker[2].length + 1 });
        sawBlank = false;
      } else if (isBlank(line)) {
        sawBlank = true;
        items.at(-1).lines.push('');
      } else if (indentOf(line) > baseIndent) {
        // Nested content (sub-list, continuation paragraph, code…).
        const item = items.at(-1);
        item.lines.push(line.slice(Math.min(indentOf(line), item.contentIndent)));
        sawBlank = false;
      } else if (!sawBlank && !parser.startsNewBlock(lines, i)) {
        items.at(-1).lines.push(line.trim()); // lazy continuation
      } else {
        break;
      }
      i++;
    }

    // Trailing blank lines belong to the document, not to the last item.
    const last = items.at(-1).lines;
    while (last.length > 1 && isBlank(last.at(-1))) last.pop();
    while (i > start && isBlank(lines[i - 1])) i--;

    const tag = ordered ? 'ol' : 'ul';
    const startNumber = ordered ? parseInt(first[2], 10) : 1;
    const startAttr = startNumber !== 1 ? ` start="${startNumber}"` : '';
    const body = items.map((item) => renderListItem(item.lines, parser, !loose)).join('\n');
    return { html: `<${tag}${startAttr}>\n${body}\n</${tag}>`, next: i };
  },
};

function renderListItem(itemLines, parser, tight) {
  const task = TASK.exec(itemLines[0]);
  if (!task) return `<li>${parser.parseLines(itemLines, { tight })}</li>`;

  const checked = task[1].toLowerCase() === 'x' ? ' checked' : '';
  const rest = [itemLines[0].replace(TASK, ''), ...itemLines.slice(1)];
  return `<li class="task-list-item"><input type="checkbox" disabled${checked}> ${parser.parseLines(rest, { tight })}</li>`;
}

/**
 * GitHub-style tables: header row, a |---|:---:| delimiter row, body rows.
 * What counts as a cell is defined in tableSyntax.js (shared with the
 * editor's table tools).
 */
export const table = {
  name: 'table',
  interruptsParagraph: true,
  test: (lines, i) => lines[i].includes('|') && TABLE_DELIMITER.test(lines[i + 1] ?? ''),
  consume(lines, start, parser) {
    const headers = splitRow(lines[start]);
    const aligns = splitRow(lines[start + 1]).map(parseAlign);
    const cell = (tag, text, col) => {
      const style = aligns[col] ? ` style="text-align:${aligns[col]}"` : '';
      return `<${tag}${style}>${parser.inline(text ?? '')}</${tag}>`;
    };

    let i = start + 2;
    const rows = [];
    while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
      const cells = splitRow(lines[i]);
      rows.push(`<tr>${headers.map((_, col) => cell('td', cells[col], col)).join('')}</tr>`);
      i++;
    }

    const head = `<tr>${headers.map((h, col) => cell('th', h, col)).join('')}</tr>`;
    return {
      html: `<table>\n<thead>${head}</thead>\n<tbody>${rows.join('\n')}</tbody>\n</table>`,
      next: i,
    };
  },
};

/** Four-space indented code. Can't interrupt a paragraph (ambiguous). */
const INDENTED = /^ {4,}\S/;
export const indentedCode = {
  name: 'indentedCode',
  interruptsParagraph: false,
  test: (lines, i) => INDENTED.test(lines[i]),
  consume(lines, start) {
    const body = [];
    let i = start;
    while (i < lines.length && (INDENTED.test(lines[i]) || isBlank(lines[i]))) {
      body.push(lines[i].slice(4));
      i++;
    }
    while (body.length && isBlank(body.at(-1))) { body.pop(); i--; }
    return { html: `<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`, next: i };
  },
};

/**
 * Paragraph — the fallback; its test always succeeds, so it MUST be last.
 * Also handles "setext" headings (a line underlined with === or ---).
 */
const SETEXT = /^ {0,3}(=+|-+) *$/;
export const paragraph = {
  name: 'paragraph',
  interruptsParagraph: false,
  test: () => true,
  consume(lines, start, parser, options = {}) {
    const text = [lines[start].trimStart()];
    let i = start + 1;
    while (i < lines.length && !isBlank(lines[i])) {
      if (SETEXT.test(lines[i])) {
        const level = lines[i].trim()[0] === '=' ? 1 : 2;
        const html = parser.inline(text.join('\n'));
        return { html: `<h${level} id="${slugify(html)}">${html}</h${level}>`, next: i + 1 };
      }
      if (parser.startsNewBlock(lines, i)) break;
      text.push(lines[i].trimStart());
      i++;
    }
    const html = parser.inline(text.join('\n').trimEnd());
    return { html: options.tight ? html : `<p>${html}</p>`, next: i };
  },
};

/** Default priority order. Paragraph must stay last. */
export const defaultBlockRules = [
  fencedCode,
  heading,
  horizontalRule,
  blockquote,
  list,
  table,
  indentedCode,
  paragraph,
];
