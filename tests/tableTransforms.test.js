/**
 * Unit tests for the table editing tools.  Run with:  npm test
 *
 * Notation (same as textTransforms.test.js): "|" inside a string would clash
 * with table pipes, so here the caret is marked with "‸" and a selection
 * with "[" … "]".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as t from '../src/js/editor/tableTransforms.js';
import { cellSpans, splitRow, parseAlign } from '../src/js/markdown/tableSyntax.js';

function state(marked) {
  const caret = marked.indexOf('‸');
  if (caret !== -1) return { text: marked.replace('‸', ''), start: caret, end: caret };
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return { text: marked.replace('[', '').replace(']', ''), start, end };
}

function apply(s, edit) {
  if (!edit) return null;
  const text = s.text.slice(0, edit.from) + edit.insert + s.text.slice(edit.to);
  if (edit.selectStart === edit.selectEnd) return `${text.slice(0, edit.selectStart)}‸${text.slice(edit.selectStart)}`;
  return `${text.slice(0, edit.selectStart)}[${text.slice(edit.selectStart, edit.selectEnd)}]${text.slice(edit.selectEnd)}`;
}

const run = (fn, marked, ...args) => {
  const s = state(marked);
  return apply(s, fn(s, ...args));
};

const lines = (...rows) => rows.join('\n');

/* ── shared syntax ── */

test('cellSpans / splitRow handle optional outer pipes and escaped pipes', () => {
  assert.deepEqual(splitRow('| a | b |'), ['a', 'b']);
  assert.deepEqual(splitRow('a | b'), ['a', 'b']);
  assert.deepEqual(splitRow('| a \\| b | c |'), ['a \\| b', 'c']);
  assert.deepEqual(splitRow('|  | x |'), ['', 'x']);
  assert.deepEqual(cellSpans('| ab | c |'), [{ start: 2, end: 4 }, { start: 7, end: 8 }]);
});

test('parseAlign', () => {
  assert.equal(parseAlign(':---'), 'left');
  assert.equal(parseAlign('---:'), 'right');
  assert.equal(parseAlign(':---:'), 'center');
  assert.equal(parseAlign('---'), '');
});

/* ── finding ── */

test('findTable reads the model and the caret cell', () => {
  const found = t.findTable(state(lines('| a | b |', '|---|---|', '| c | d‸ |')));
  assert.deepEqual(found.model, { rows: [['a', 'b'], ['c', 'd']], aligns: ['', ''] });
  assert.deepEqual(found.caret, { row: 1, col: 1, offset: 1 });
});

test('findTable ignores text that is not a table, and paragraphs around it', () => {
  assert.equal(t.findTable(state('just a | pipe‸')), null);
  assert.equal(t.findTable(state('no pipes‸')), null);
  const found = t.findTable(state(lines('intro', '', '| a |', '|---|', '| b‸ |', '', 'outro')));
  assert.deepEqual(found.model.rows, [['a'], ['b']]);
});

test('ragged rows are padded to the same column count', () => {
  const found = t.findTable(state(lines('| a | b | c |', '|---|---|---|', '| x‸ |')));
  assert.deepEqual(found.model.rows[1], ['x', '', '']);
});

/* ── formatting ── */

test('formatTable pads columns and respects alignment', () => {
  const result = run(t.formatTable, lines(
    '| Name | Qty |',
    '|:--|--:|',
    '| Apple‸ | 3 |',
  ));
  assert.equal(result, lines(
    '| Name  | Qty |',
    '| :---- | --: |',
    '| Apple‸ |   3 |',
  ));
});

test('centre alignment splits the padding', () => {
  const result = run(t.formatTable, lines('| a‸ |', '|:-:|', '| bbbbb |'));
  assert.equal(result, lines('|   a‸   |', '| :---: |', '| bbbbb |'));
});

test('an already formatted table only moves the caret (no empty undo step)', () => {
  const s = state(lines('| a   |', '| --- |', '| b‸   |'));
  const edit = t.formatTable(s);
  assert.equal(edit.insert, '');
});

/* ── navigation ── */

test('Tab moves to the next cell and wraps to the next row', () => {
  assert.equal(run(t.nextCell, lines('| a‸ | b |', '|---|---|', '| c | d |')),
    lines('| a   | [b]   |', '| --- | --- |', '| c   | d   |'));
  assert.equal(run(t.nextCell, lines('| a | b‸ |', '|---|---|', '| c | d |')),
    lines('| a   | b   |', '| --- | --- |', '| [c]   | d   |'));
});

test('Tab in the last cell adds a new row', () => {
  assert.equal(run(t.nextCell, lines('| a | b |', '|---|---|', '| c | d‸ |')),
    lines('| a   | b   |', '| --- | --- |', '| c   | d   |', '| ‸    |     |'));
});

test('without auto-format, Tab moves the caret and leaves the text alone', () => {
  const s = state(lines('| a‸ | b |', '|---|---|'));
  const edit = t.nextCell(s, { pad: false });
  assert.equal(edit.insert, '');
  assert.equal(apply(s, edit), lines('| a | [b] |', '|---|---|'));
});

test('⇧Tab goes back, wrapping to the previous row, stopping at the first cell', () => {
  assert.equal(run(t.prevCell, lines('| a | b |', '|---|---|', '| ‸c | d |'), { pad: false }),
    lines('| a | [b] |', '|---|---|', '| c | d |'));
  assert.equal(run(t.prevCell, lines('| ‸a | b |', '|---|---|'), { pad: false }),
    lines('| [a] | b |', '|---|---|'));
});

test('moving into a cell selects its text (typing replaces it)', () => {
  assert.equal(run(t.nextCell, lines('| Name‸ | Column 2 |', '|---|---|'), { pad: false }),
    lines('| Name | [Column 2] |', '|---|---|'));
});

test('Enter goes down a row in the same column, adding a row at the end', () => {
  assert.equal(run(t.nextRow, lines('| a | b‸ |', '|---|---|', '| c | d |'), { pad: false }),
    lines('| a | b |', '|---|---|', '| c | [d] |'));
  assert.equal(run(t.nextRow, lines('| a | b |', '|---|---|', '| c | d‸ |'), { pad: false }),
    lines('| a | b |', '| --- | --- |', '| c | d |', '|  | ‸ |'));
});

test('Enter on an empty last row removes it and leaves the table', () => {
  assert.equal(run(t.nextRow, lines('| a |', '|---|', '| b |', '| ‸ |'), { pad: false }),
    lines('| a |', '| --- |', '| b |', '‸'));
});

/* ── structure ── */

test('insert rows above/below (never above the header)', () => {
  const table = lines('| h |', '|---|', '| x‸ |');
  assert.equal(run(t.insertRow, table, 'above', { pad: false }), lines('| h |', '| --- |', '| ‸ |', '| x |'));
  assert.equal(run(t.insertRow, table, 'below', { pad: false }), lines('| h |', '| --- |', '| x |', '| ‸ |'));
  assert.equal(run(t.insertRow, lines('| h‸ |', '|---|', '| x |'), 'above', { pad: false }),
    lines('| h |', '| --- |', '| ‸ |', '| x |'));
});

test('delete a row; the header row cannot be deleted', () => {
  assert.equal(run(t.deleteRow, lines('| h |', '|---|', '| x‸ |', '| y |'), { pad: false }),
    lines('| h |', '| --- |', '| y‸ |'));
  assert.equal(run(t.deleteRow, lines('| h‸ |', '|---|', '| x |')), null);
});

test('insert and delete columns', () => {
  assert.equal(run(t.insertColumn, lines('| a‸ | b |', '|:--|---|'), 'right', { pad: false }),
    lines('| a | ‸ | b |', '| :-- | --- | --- |'));
  assert.equal(run(t.deleteColumn, lines('| a | b‸ |', '|---|--:|', '| c | d |'), { pad: false }),
    lines('| a‸ |', '| --- |', '| c |'));
  assert.equal(run(t.deleteColumn, lines('| a‸ |', '|---|')), null);
});

test('align a column', () => {
  assert.equal(run(t.alignColumn, lines('| a | b‸ |', '|---|---|', '| c | dd |'), 'right'),
    lines('| a   |   b‸ |', '| --- | --: |', '| c   |  dd |'));
});

test('create a table: header placeholders, first cell selected, blank lines around it', () => {
  assert.equal(run(t.createTable, 'Intro‸', 2, 3), lines(
    'Intro',
    '',
    '| [Column 1] | Column 2 |',
    '| -------- | -------- |',
    '|          |          |',
    '|          |          |',
    '',
    '',
  ));
});

test('escaped pipes survive a reformat', () => {
  assert.equal(run(t.formatTable, lines('| a \\| b‸ |', '|---|')), lines('| a \\| b‸ |', '| ------ |'));
});
