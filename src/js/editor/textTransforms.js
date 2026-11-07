/**
 * @file textTransforms.js
 * PURE functions that compute how to format Markdown source text.
 *
 * WHY PURE FUNCTIONS?
 * They receive a snapshot `{ text, start, end }` (the textarea value and its
 * selection) and return a description of the change — they never touch the
 * DOM. Benefits:
 *   - trivially unit-testable in Node (see tests/textTransforms.test.js);
 *   - the view decides HOW to apply the change (keeping native undo/redo);
 *   - the same logic would work with any other editor widget.
 *
 * @typedef {Object} TextState
 * @property {string} text   Full document text.
 * @property {number} start  Selection start (offset).
 * @property {number} end    Selection end (offset).
 *
 * @typedef {Object} TextEdit  "Replace text[from..to] with `insert`, then select [selectStart..selectEnd]".
 * @property {number} from
 * @property {number} to
 * @property {string} insert
 * @property {number} selectStart  Absolute offset in the NEW text.
 * @property {number} selectEnd
 */

/* ───────────────────────── helpers ───────────────────────── */

/**
 * Expands a selection to whole lines.
 * A selection ending exactly at the start of a line does NOT include that
 * line (matches how every text editor behaves when you drag-select lines).
 */
export function lineRange(text, start, end) {
  const from = text.lastIndexOf('\n', start - 1) + 1;
  const effectiveEnd = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const nl = text.indexOf('\n', effectiveEnd);
  const to = nl === -1 ? text.length : nl;
  return { from, to };
}

/** Regex matching any block-level prefix we know how to replace. */
const BLOCK_PREFIX = /^(\s*)(#{1,6} +|> ?|[-*+] \[[ xX]\] +|[-*+] +|\d+[.)] +)?/;

/** Removes heading/quote/list markers from one line. */
const stripBlockPrefix = (line) => line.replace(BLOCK_PREFIX, '$1');

/**
 * Builds a TextEdit replacing whole lines.
 * Afterwards: a multi-character selection stays selected (so you can apply
 * another style); a plain caret goes to the end of the line (so you can
 * keep typing, e.g. right after choosing "Heading 1" on an empty line).
 */
function replaceLines(state, transformLines) {
  const { from, to } = lineRange(state.text, state.start, state.end);
  const lines = state.text.slice(from, to).split('\n');
  const insert = transformLines(lines).join('\n');
  const end = from + insert.length;
  return state.start === state.end
    ? { from, to, insert, selectStart: end, selectEnd: end }
    : { from, to, insert, selectStart: from, selectEnd: end };
}

/* ───────────────────────── inline formatting ───────────────────────── */

/**
 * Wraps the selection with a marker (e.g. "**") or removes it if present.
 * With an empty selection, inserts `marker + placeholder + marker` and selects
 * the placeholder so the user can type over it.
 * @param {TextState} state
 * @param {string} marker       e.g. "**", "*", "~~", "`"
 * @param {string} placeholder  e.g. "bold text"
 * @returns {TextEdit}
 */
export function toggleWrap(state, marker, placeholder = 'text') {
  const { text, start, end } = state;
  const m = marker.length;
  const selected = text.slice(start, end);

  // Case 1: markers are just outside the selection → **|word|**
  if (text.slice(start - m, start) === marker && text.slice(end, end + m) === marker) {
    return { from: start - m, to: end + m, insert: selected, selectStart: start - m, selectEnd: end - m };
  }
  // Case 2: markers are inside the selection → |**word**|
  if (selected.length >= 2 * m && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(m, -m);
    return { from: start, to: end, insert: inner, selectStart: start, selectEnd: start + inner.length };
  }
  // Case 3: wrap.
  const content = selected || placeholder;
  return {
    from: start,
    to: end,
    insert: `${marker}${content}${marker}`,
    selectStart: start + m,
    selectEnd: start + m + content.length,
  };
}

/**
 * Turns the selection into a link. The URL part is selected afterwards so the
 * user can immediately type/paste it. A selected URL becomes the link target.
 * @param {TextState} state
 * @returns {TextEdit}
 */
export function insertLink(state) {
  const { text, start, end } = state;
  const selected = text.slice(start, end);
  if (/^https?:\/\/\S+$/.test(selected)) {
    const insert = `[link text](${selected})`;
    return { from: start, to: end, insert, selectStart: start + 1, selectEnd: start + 10 };
  }
  const label = selected || 'link text';
  const insert = `[${label}](https://)`;
  const urlStart = start + label.length + 3;
  return { from: start, to: end, insert, selectStart: urlStart, selectEnd: urlStart + 8 };
}

/* ───────────────────────── block formatting ───────────────────────── */

/**
 * Applies a paragraph style to every selected line, REPLACING any existing
 * heading/quote/list prefix (like TextEdit's paragraph-style popup).
 * @param {TextState} state
 * @param {string} prefix  "" for body text, "# " for title, "> " for quote…
 * @returns {TextEdit}
 */
export function setLinePrefix(state, prefix) {
  return replaceLines(state, (lines) =>
    lines.map((line) => {
      const bare = stripBlockPrefix(line);
      // In a multi-line selection, blank lines stay blank ("# " alone would be
      // an empty heading). A single empty line DOES get the prefix: the user
      // is about to type the heading.
      const skip = lines.length > 1 && bare.trim() === '' && prefix !== '';
      return skip ? line : prefix + bare.trimStart();
    }),
  );
}

/**
 * Toggles a list style on the selected lines. If ALL non-empty lines already
 * use this style it's removed; otherwise it's applied (replacing other styles).
 * @param {TextState} state
 * @param {'bullet'|'ordered'|'task'} kind
 * @returns {TextEdit}
 */
export function toggleList(state, kind) {
  const detectors = {
    bullet: /^\s*[-*+] (?!\[[ xX]\])/,
    ordered: /^\s*\d+[.)] /,
    task: /^\s*[-*+] \[[ xX]\] /,
  };
  const makePrefix = {
    bullet: () => '- ',
    ordered: (n) => `${n}. `,
    task: () => '- [ ] ',
  };

  return replaceLines(state, (lines) => {
    const content = lines.filter((l) => l.trim() !== '');
    const alreadyApplied = content.length > 0 && content.every((l) => detectors[kind].test(l));
    let n = 0;
    return lines.map((line) => {
      if (line.trim() === '') return line;
      const bare = stripBlockPrefix(line).trimStart();
      return alreadyApplied ? bare : makePrefix[kind](++n) + bare;
    });
  });
}

/**
 * Wraps the selected lines in a fenced code block (or unwraps if the
 * selection already is one).
 * @param {TextState} state
 * @returns {TextEdit}
 */
export function toggleCodeBlock(state) {
  return replaceLines(state, (lines) => {
    if (lines.length >= 2 && /^```/.test(lines[0]) && /^```\s*$/.test(lines.at(-1))) {
      return lines.slice(1, -1);
    }
    return ['```', ...lines, '```'];
  });
}

/**
 * Inserts a block snippet (table, horizontal rule…) on its own lines,
 * adding blank lines around it when needed so Markdown parses it as a block.
 * @param {TextState} state
 * @param {string} snippet
 * @returns {TextEdit}
 */
export function insertBlock(state, snippet) {
  const { text, start, end } = state;
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after.startsWith('\n') ? '\n' : '\n\n';
  const insert = lead + snippet + trail;
  const pos = start + lead.length;
  return { from: start, to: end, insert, selectStart: pos, selectEnd: pos + snippet.length };
}

/* ───────────────────────── smart keys ───────────────────────── */

const CONTINUABLE = /^(\s*)((?:[-*+] \[[ xX]\] )|(?:[-*+] )|(?:(\d+)([.)]) )|(?:> ?))(.*)$/;

/**
 * Behaviour for Enter inside a list or quote (like Notes, Bear, Typora…):
 *  - "- item|"   → new line starting with "- "
 *  - "3. item|"  → new line starting with "4. "
 *  - "- [x] a|"  → new line starting with "- [ ] "
 *  - "- |" (empty item) → the marker is removed, ending the list.
 * Returns null when Enter should behave normally.
 * @param {TextState} state
 * @returns {TextEdit|null}
 */
export function continueList(state) {
  const { text, start, end } = state;
  if (start !== end) return null;

  const { from: lineStart, to: lineEnd } = lineRange(text, start, start);
  const match = CONTINUABLE.exec(text.slice(lineStart, lineEnd));
  if (!match) return null;

  const [, indent, marker, number, delimiter, content] = match;
  if (start < lineStart + indent.length + marker.length) return null; // caret inside the marker

  if (content.trim() === '') {
    return { from: lineStart, to: lineEnd, insert: '', selectStart: lineStart, selectEnd: lineStart };
  }

  let next = marker;
  if (number !== undefined) next = `${Number(number) + 1}${delimiter} `;
  else if (/\[[ xX]\]/.test(marker)) next = `${marker[0]} [ ] `;
  else if (marker.startsWith('>')) next = '> ';

  const insert = `\n${indent}${next}`;
  return { from: start, to: start, insert, selectStart: start + insert.length, selectEnd: start + insert.length };
}

/** True when the caret's line is a list item (Tab then nests it). */
export function isOnListLine(state) {
  const { from, to } = lineRange(state.text, state.start, state.start);
  return /^\s*([-*+]|\d+[.)]) /.test(state.text.slice(from, to));
}

const INDENT = '  '; // two spaces: enough to nest list items, not enough to become a code block

/**
 * Indents every selected line (Tab).
 * @param {TextState} state
 * @returns {TextEdit}
 */
export function indentLines(state) {
  const { from, to } = lineRange(state.text, state.start, state.end);
  const lines = state.text.slice(from, to).split('\n');
  const insert = lines.map((l) => INDENT + l).join('\n');
  if (state.start === state.end) {
    const caret = state.start + INDENT.length;
    return { from, to, insert, selectStart: caret, selectEnd: caret };
  }
  return { from, to, insert, selectStart: from, selectEnd: from + insert.length };
}

/**
 * Removes up to one indent level from every selected line (Shift+Tab).
 * @param {TextState} state
 * @returns {TextEdit}
 */
export function outdentLines(state) {
  const { from, to } = lineRange(state.text, state.start, state.end);
  const lines = state.text.slice(from, to).split('\n');
  const removedFirst = lines[0].match(/^ {0,2}/)[0].length;
  const insert = lines.map((l) => l.replace(/^ {1,2}/, '')).join('\n');
  if (state.start === state.end) {
    const caret = Math.max(from, state.start - removedFirst);
    return { from, to, insert, selectStart: caret, selectEnd: caret };
  }
  return { from, to, insert, selectStart: from, selectEnd: from + insert.length };
}

/**
 * Which paragraph style is the caret's line using? Lets the toolbar popup
 * reflect the current line, exactly like TextEdit's style menu does.
 * @param {TextState} state
 * @returns {string} '' | '# ' | '## ' … | '> '
 */
export function detectLinePrefix(state) {
  const { from, to } = lineRange(state.text, state.start, state.start);
  const line = state.text.slice(from, to);
  const heading = /^ {0,3}(#{1,6}) /.exec(line);
  if (heading) return `${heading[1]} `;
  if (/^ {0,3}>/.test(line)) return '> ';
  return '';
}
