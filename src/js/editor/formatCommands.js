/**
 * @file formatCommands.js
 * DECLARATIVE table of every formatting action the toolbar/shortcuts offer.
 *
 * Each entry says: "command id X runs transform Y on the editor state".
 * The registration code (app/registerCommands.js) simply loops over this
 * list. Adding a new formatting button = adding one line here + one button
 * in index.html. No other file changes (Open/Closed principle).
 */

import {
  toggleWrap,
  insertLink,
  setLinePrefix,
  toggleList,
  toggleCodeBlock,
  insertBlock,
} from './textTransforms.js';
import * as tables from './tableTransforms.js';

/**
 * Paragraph styles shown in the "¶" popup. `prefix` is what gets written at
 * the start of the line. Single source of truth: the popup's <option>s are
 * generated from this list.
 */
export const PARAGRAPH_STYLES = [
  { label: 'Body', prefix: '' },
  { label: 'Heading 1', prefix: '# ' },
  { label: 'Heading 2', prefix: '## ' },
  { label: 'Heading 3', prefix: '### ' },
  { label: 'Heading 4', prefix: '#### ' },
  { label: 'Heading 5', prefix: '##### ' },
  { label: 'Heading 6', prefix: '###### ' },
  { label: 'Quote', prefix: '> ' },
];

/**
 * @typedef {Object} FormatCommand
 * @property {string} id
 * @property {string} label
 * @property {(state: import('./textTransforms.js').TextState, arg?: any)
 *            => import('./textTransforms.js').TextEdit} transform
 */

/** @type {FormatCommand[]} */
export const FORMAT_COMMANDS = [
  { id: 'format.bold', label: 'Bold', transform: (s) => toggleWrap(s, '**', 'bold text') },
  { id: 'format.italic', label: 'Italic', transform: (s) => toggleWrap(s, '*', 'italic text') },
  { id: 'format.strikethrough', label: 'Strikethrough', transform: (s) => toggleWrap(s, '~~', 'struck text') },
  { id: 'format.code', label: 'Inline Code', transform: (s) => toggleWrap(s, '`', 'code') },
  { id: 'format.link', label: 'Link', transform: insertLink },
  { id: 'format.paragraphStyle', label: 'Paragraph Style', transform: (s, prefix = '') => setLinePrefix(s, prefix) },
  { id: 'format.bulletList', label: 'Bulleted List', transform: (s) => toggleList(s, 'bullet') },
  { id: 'format.orderedList', label: 'Numbered List', transform: (s) => toggleList(s, 'ordered') },
  { id: 'format.taskList', label: 'Checklist', transform: (s) => toggleList(s, 'task') },
  { id: 'format.codeBlock', label: 'Code Block', transform: toggleCodeBlock },
  { id: 'insert.rule', label: 'Insert Horizontal Rule', transform: (s) => insertBlock(s, '---') },
];

/**
 * Table commands. Same shape as FORMAT_COMMANDS, plus:
 *  - the transform receives `ctx.pad` (the "Format Tables Automatically"
 *    preference), see tableTransforms.js;
 *  - `unavailable` is shown in the status bar when the transform returns null
 *    (caret not in a table, or e.g. trying to delete the header row).
 *
 * @typedef {FormatCommand & {unavailable?: string}} TableCommand
 */
const NOT_IN_TABLE = 'Put the cursor inside a table first';

/** "3x4" → [3 columns, 4 rows]. Without a size (menu item): 3 × 3. */
const parseSize = (arg) => (/^\d+x\d+$/.test(arg ?? '') ? arg.split('x').map(Number) : [3, 3]);

/** @type {TableCommand[]} */
export const TABLE_COMMANDS = [
  { id: 'table.insert', label: 'Insert Table', transform: (s, size) => tables.createTable(s, ...parseSize(size)) },
  { id: 'table.rowAbove', label: 'Add Row Above', transform: (s, _, ctx) => tables.insertRow(s, 'above', ctx), unavailable: NOT_IN_TABLE },
  { id: 'table.rowBelow', label: 'Add Row Below', transform: (s, _, ctx) => tables.insertRow(s, 'below', ctx), unavailable: NOT_IN_TABLE },
  { id: 'table.colLeft', label: 'Add Column Left', transform: (s, _, ctx) => tables.insertColumn(s, 'left', ctx), unavailable: NOT_IN_TABLE },
  { id: 'table.colRight', label: 'Add Column Right', transform: (s, _, ctx) => tables.insertColumn(s, 'right', ctx), unavailable: NOT_IN_TABLE },
  { id: 'table.deleteRow', label: 'Delete Row', transform: (s, _, ctx) => tables.deleteRow(s, ctx), unavailable: 'Put the cursor in a body row (the header row can’t be deleted)' },
  { id: 'table.deleteColumn', label: 'Delete Column', transform: (s, _, ctx) => tables.deleteColumn(s, ctx), unavailable: 'Put the cursor in a table with more than one column' },
  { id: 'table.alignLeft', label: 'Align Column Left', transform: (s, _, ctx) => tables.alignColumn(s, 'left', ctx), unavailable: NOT_IN_TABLE },
  { id: 'table.alignCenter', label: 'Align Column Center', transform: (s, _, ctx) => tables.alignColumn(s, 'center', ctx), unavailable: NOT_IN_TABLE },
  { id: 'table.alignRight', label: 'Align Column Right', transform: (s, _, ctx) => tables.alignColumn(s, 'right', ctx), unavailable: NOT_IN_TABLE },
  { id: 'table.format', label: 'Format Table', transform: (s) => tables.formatTable(s), unavailable: NOT_IN_TABLE },
];
