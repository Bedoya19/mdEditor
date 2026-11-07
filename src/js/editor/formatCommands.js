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

const TABLE_SNIPPET = [
  '| Column | Column |',
  '| ------ | ------ |',
  '| Cell   | Cell   |',
].join('\n');

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
  { id: 'insert.table', label: 'Insert Table', transform: (s) => insertBlock(s, TABLE_SNIPPET) },
  { id: 'insert.rule', label: 'Insert Horizontal Rule', transform: (s) => insertBlock(s, '---') },
];
