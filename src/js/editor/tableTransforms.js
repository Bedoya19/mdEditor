/**
 * @file tableTransforms.js
 * PURE functions that make Markdown tables pleasant to edit:
 *   create, move between cells (Tab / ⇧Tab / Enter), add/delete rows and
 *   columns, align columns, and "format" (pad cells so the pipes line up).
 *
 * Same contract as textTransforms.js: they take a `TextState`
 * ({ text, start, end }) and return a `TextEdit` (or null when the caret
 * isn't in a table), so they're unit-tested in Node and the editor applies
 * them with native undo.
 *
 * Moving to a cell (Tab, ⇧Tab, Enter) SELECTS its text, like a spreadsheet:
 * type to replace it, or press → to keep it and add to the end.
 *
 * HOW EVERY OPERATION WORKS
 *   1. findTable()       → read the table around the caret into a MODEL:
 *                          { rows: string[][] (row 0 = header), aligns: [] }
 *   2. change the model  → e.g. insert an empty row
 *   3. serializeTable()  → write the model back as Markdown text
 *   4. place the caret   → in the target cell (serializeTable reports where
 *                          every cell's text starts)
 *
 * `pad` (the "Format Tables Automatically" preference): when true, columns
 * are padded to their widest cell so the pipes line up. When false we don't
 * reformat your table just because you pressed Tab; we only rewrite it when
 * its structure changes (new row/column…), and then minimally.
 *
 * Known limitation: padding counts characters, so wide characters (CJK,
 * some emoji) can make a column look slightly off in the source.
 */

import { insertBlock } from './textTransforms.js';
import { TABLE_DELIMITER, cellSpans, splitRow, parseAlign } from '../markdown/tableSyntax.js';

/** @typedef {import('./textTransforms.js').TextState} TextState */
/** @typedef {import('./textTransforms.js').TextEdit} TextEdit */

/**
 * @typedef {Object} TableModel
 * @property {string[][]} rows   rows[0] is the header; every row has the same length.
 * @property {Array<'left'|'center'|'right'|''>} aligns  One per column.
 *
 * @typedef {Object} CellRef
 * @property {number} row     0 = header, 1… = body rows (the delimiter row isn't a row here)
 * @property {number} col
 * @property {number} [offset] Caret position inside the cell's text (default: at its end).
 * @property {boolean} [select] Select the cell's whole text instead (used when MOVING to a
 *           cell, spreadsheet-style: typing replaces it, an arrow key keeps it).
 */

const displayWidth = (text) => [...text].length;
const isTableLine = (line) => line !== undefined && line.trim() !== '' && line.includes('|');
const caretAt = (pos, end = pos) => ({ from: pos, to: pos, insert: '', selectStart: pos, selectEnd: end });
const cloneModel = ({ rows, aligns }) => ({ rows: rows.map((r) => [...r]), aligns: [...aligns] });

/** Number of unescaped pipes in `line` before position `pos`. */
function pipesBefore(line, pos) {
  let count = 0;
  for (let i = 0; i < pos && i < line.length; i++) {
    if (line[i] === '\\') { i++; continue; }
    if (line[i] === '|') count++;
  }
  return count;
}

/* ───────────────────────── reading ───────────────────────── */

/**
 * Finds the table containing the caret.
 * @param {TextState} state
 * @returns {null | {
 *   from: number, to: number,          // the table's offsets in the text
 *   lines: string[], lineOffsets: number[],  // its original lines and where each starts
 *   model: TableModel, caret: Required<CellRef>
 * }}
 */
export function findTable({ text, start }) {
  // Cheap early exit: this runs on every caret move.
  const caretLineStart = text.lastIndexOf('\n', start - 1) + 1;
  const caretLineEnd = text.indexOf('\n', start) === -1 ? text.length : text.indexOf('\n', start);
  if (!text.slice(caretLineStart, caretLineEnd).includes('|')) return null;

  const all = text.split('\n');
  let caretLine = 0;
  for (let i = 0; i < caretLineStart; i++) if (text[i] === '\n') caretLine++;

  // The block of consecutive lines containing pipes around the caret…
  let first = caretLine;
  let last = caretLine;
  while (first > 0 && isTableLine(all[first - 1])) first--;
  while (last < all.length - 1 && isTableLine(all[last + 1])) last++;

  // …must contain a header followed by a delimiter row, at or above the caret.
  let header = -1;
  for (let i = first + 1; i <= last; i++) {
    if (TABLE_DELIMITER.test(all[i])) { header = i - 1; break; }
  }
  if (header === -1 || caretLine < header) return null;

  let from = 0;
  for (let i = 0; i < header; i++) from += all[i].length + 1;
  const lines = all.slice(header, last + 1);
  const lineOffsets = [];
  lines.reduce((offset, line) => { lineOffsets.push(offset); return offset + line.length + 1; }, 0);

  // Model, with every row padded to the same number of columns.
  const headerCells = splitRow(lines[0]);
  const body = lines.slice(2).map(splitRow);
  const cols = Math.max(headerCells.length, ...body.map((r) => r.length));
  const fill = (cells) => [...cells, ...Array(cols - cells.length).fill('')];
  const rows = [fill(headerCells), ...body.map(fill)];
  const aligns = fill(splitRow(lines[1]).map(parseAlign));

  // Caret → cell.
  const lineIndex = caretLine - header;               // 0 header, 1 delimiter, 2… body
  const row = lineIndex <= 1 ? 0 : lineIndex - 1;
  const line = lines[lineIndex];
  const posInLine = start - from - lineOffsets[lineIndex];
  const leadingPipe = line.trimStart().startsWith('|') ? 1 : 0;
  const col = Math.min(cols - 1, Math.max(0, pipesBefore(line, posInLine) - leadingPipe));
  const span = cellSpans(line)[col];
  const offset = lineIndex === 1 || !span ? 0
    : Math.min(span.end - span.start, Math.max(0, posInLine - span.start));

  return {
    from,
    to: from + lines.join('\n').length,
    lines,
    lineOffsets,
    model: { rows, aligns },
    caret: { row, col, offset },
  };
}

/** True if the caret is inside a table (enables the table commands). */
export const isInTable = (state) => findTable(state) !== null;

/* ───────────────────────── writing ───────────────────────── */

/**
 * Writes a model back as Markdown.
 * @param {TableModel} model
 * @param {{pad?: boolean}} [options]
 * @returns {{text: string, cellStart: (row: number, col: number) => number}}
 *   cellStart = offset (within `text`) where that cell's text begins.
 */
export function serializeTable({ rows, aligns }, { pad = true } = {}) {
  const widths = aligns.map((_, c) => (pad ? Math.max(3, ...rows.map((r) => displayWidth(r[c]))) : 3));
  const lines = [];
  const starts = [];
  let offset = 0;

  const writeRow = (cells) => {
    let line = '|';
    const rowStarts = [];
    cells.forEach((cell, c) => {
      const extra = pad ? widths[c] - displayWidth(cell) : 0;
      const before = aligns[c] === 'right' ? extra : aligns[c] === 'center' ? Math.floor(extra / 2) : 0;
      line += ` ${' '.repeat(before)}`;
      rowStarts.push(offset + line.length);
      line += `${cell}${' '.repeat(extra - before)} |`;
    });
    starts.push(rowStarts);
    lines.push(line);
    offset += line.length + 1;
  };

  const delimiterCell = (align, w) => {
    if (align === 'center') return `:${'-'.repeat(w - 2)}:`;
    if (align === 'left') return `:${'-'.repeat(w - 1)}`;
    if (align === 'right') return `${'-'.repeat(w - 1)}:`;
    return '-'.repeat(w);
  };

  writeRow(rows[0]);
  const delimiter = `| ${aligns.map((a, c) => delimiterCell(a, widths[c])).join(' | ')} |`;
  lines.push(delimiter);
  offset += delimiter.length + 1;
  rows.slice(1).forEach(writeRow);

  return { text: lines.join('\n'), cellStart: (row, col) => starts[row][col] };
}

/**
 * Rewrites the table from `model` and puts the caret in `target`.
 * If nothing actually changed, only the caret moves (no empty undo step).
 */
function rewrite(table, model, target, pad) {
  const out = serializeTable(model, { pad });
  const cell = model.rows[target.row][target.col];
  const cellStart = table.from + out.cellStart(target.row, target.col);
  const [selectStart, selectEnd] = target.select
    ? [cellStart, cellStart + cell.length]
    : Array(2).fill(cellStart + Math.min(target.offset ?? cell.length, cell.length));
  if (out.text === table.lines.join('\n')) return caretAt(selectStart, selectEnd);
  return { from: table.from, to: table.to, insert: out.text, selectStart, selectEnd };
}

/**
 * Moves to `target`. Without `pad` and without structural changes, the text
 * is left exactly as the user wrote it and only the caret moves.
 */
function goTo(table, model, target, { pad, structural }) {
  if (pad || structural) return rewrite(table, model, target, pad);
  const lineIndex = target.row === 0 ? 0 : target.row + 1;
  const span = cellSpans(table.lines[lineIndex])[target.col];
  if (!span) return rewrite(table, model, target, false); // that row is missing cells: fix it
  const lineStart = table.from + table.lineOffsets[lineIndex];
  return target.select
    ? caretAt(lineStart + span.start, lineStart + span.end)
    : caretAt(lineStart + span.end);
}

/* ───────────────────────── operations ───────────────────────── */

/**
 * New table at the caret: a header row ("Column 1"…) and empty body rows.
 * The first header cell is selected so you can type over it.
 * @param {TextState} state
 * @param {number} cols
 * @param {number} rows  Total rows INCLUDING the header (min 2).
 * @returns {TextEdit}
 */
export function createTable(state, cols, rows) {
  const c = Math.max(1, cols);
  const r = Math.max(2, rows);
  const model = {
    rows: [
      Array.from({ length: c }, (_, i) => `Column ${i + 1}`),
      ...Array.from({ length: r - 1 }, () => Array(c).fill('')),
    ],
    aligns: Array(c).fill(''),
  };
  const out = serializeTable(model, { pad: true });
  const edit = insertBlock(state, out.text);
  const first = edit.selectStart + out.cellStart(0, 0);
  return { ...edit, selectStart: first, selectEnd: first + model.rows[0][0].length };
}

/** Tab: next cell, wrapping to the next row; past the last cell, adds a row. */
export function nextCell(state, { pad = true } = {}) {
  const table = findTable(state);
  if (!table) return null;
  const model = cloneModel(table.model);
  const cols = model.aligns.length;
  let { row, col } = table.caret;
  col++;
  if (col >= cols) { col = 0; row++; }
  const structural = row >= model.rows.length;
  if (structural) model.rows.push(Array(cols).fill(''));
  return goTo(table, model, { row, col, select: true }, { pad, structural });
}

/** ⇧Tab: previous cell, wrapping to the previous row (stops at the first cell). */
export function prevCell(state, { pad = true } = {}) {
  const table = findTable(state);
  if (!table) return null;
  const cols = table.model.aligns.length;
  let { row, col } = table.caret;
  col--;
  if (col < 0) { row--; col = cols - 1; }
  if (row < 0) { row = 0; col = 0; }
  return goTo(table, cloneModel(table.model), { row, col, select: true }, { pad, structural: false });
}

/**
 * Enter: same column, next row (adding one at the end).
 * Enter on an EMPTY last row removes it and leaves the table, like ending a list.
 */
export function nextRow(state, { pad = true } = {}) {
  const table = findTable(state);
  if (!table) return null;
  const model = cloneModel(table.model);
  const { row, col } = table.caret;
  const isLast = row === model.rows.length - 1;

  if (isLast && row > 0 && model.rows[row].every((cell) => cell.trim() === '')) {
    model.rows.pop();
    const out = serializeTable(model, { pad });
    const insert = `${out.text}\n`;
    const caret = table.from + insert.length;
    return { from: table.from, to: table.to, insert, selectStart: caret, selectEnd: caret };
  }

  const structural = isLast;
  if (structural) model.rows.push(Array(model.aligns.length).fill(''));
  return goTo(table, model, { row: row + 1, col, select: true }, { pad, structural });
}

/** Adds an empty row above or below the caret's row (never above the header). */
export function insertRow(state, where, { pad = true } = {}) {
  const table = findTable(state);
  if (!table) return null;
  const model = cloneModel(table.model);
  const { row, col } = table.caret;
  const index = where === 'above' ? Math.max(1, row) : row + 1;
  model.rows.splice(index, 0, Array(model.aligns.length).fill(''));
  return rewrite(table, model, { row: index, col }, pad);
}

/** Deletes the caret's row. The header row can't be deleted (returns null). */
export function deleteRow(state, { pad = true } = {}) {
  const table = findTable(state);
  if (!table || table.caret.row === 0) return null;
  const model = cloneModel(table.model);
  const { row, col } = table.caret;
  model.rows.splice(row, 1);
  return rewrite(table, model, { row: Math.min(row, model.rows.length - 1), col }, pad);
}

/** Adds an empty column to the left or right of the caret's column. */
export function insertColumn(state, where, { pad = true } = {}) {
  const table = findTable(state);
  if (!table) return null;
  const model = cloneModel(table.model);
  const { row, col } = table.caret;
  const index = where === 'left' ? col : col + 1;
  model.rows.forEach((cells) => cells.splice(index, 0, ''));
  model.aligns.splice(index, 0, '');
  return rewrite(table, model, { row, col: index }, pad);
}

/** Deletes the caret's column. A table's only column can't be deleted (returns null). */
export function deleteColumn(state, { pad = true } = {}) {
  const table = findTable(state);
  if (!table || table.model.aligns.length === 1) return null;
  const model = cloneModel(table.model);
  const { row, col } = table.caret;
  model.rows.forEach((cells) => cells.splice(col, 1));
  model.aligns.splice(col, 1);
  return rewrite(table, model, { row, col: Math.min(col, model.aligns.length - 1) }, pad);
}

/**
 * Sets the caret column's alignment.
 * @param {'left'|'center'|'right'|''} align  '' = default (no colons)
 */
export function alignColumn(state, align, { pad = true } = {}) {
  const table = findTable(state);
  if (!table) return null;
  const model = cloneModel(table.model);
  model.aligns[table.caret.col] = align;
  return rewrite(table, model, table.caret, pad);
}

/** Pads every column so the pipes line up (always pads, whatever the preference). */
export function formatTable(state) {
  const table = findTable(state);
  if (!table) return null;
  return rewrite(table, cloneModel(table.model), table.caret, true);
}
