/**
 * @file smartKeys.js
 * Writer-friendly keyboard behaviour inside the editor:
 *   In a table: Tab / ⇧Tab → next / previous cell, Enter → cell below
 *               (see tableTransforms.js)
 *   Enter      → continue lists / quotes (see continueList)
 *   Tab        → nest list items, or insert two spaces
 *   Shift+Tab  → outdent
 *   Esc, Tab   → leave the editor (keyboard accessibility: without this,
 *                capturing Tab would trap keyboard users in the textarea).
 *
 * Separated from EditorView so the view stays a thin DOM wrapper and these
 * Markdown-specific rules live in one place.
 */

import { continueList, indentLines, outdentLines, isOnListLine } from './textTransforms.js';
import { nextCell, prevCell, nextRow } from './tableTransforms.js';

/**
 * @param {import('../ui/EditorView.js').EditorView} editor
 * @param {{autoFormatTables?: () => boolean}} [options]
 *   autoFormatTables: read on every key press, so toggling the preference
 *   takes effect immediately.
 */
export function attachSmartKeys(editor, { autoFormatTables = () => true } = {}) {
  let escapeArmed = false;

  editor.textarea.addEventListener('keydown', (event) => {
    if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === 'Escape') { escapeArmed = true; return; }
    const leaveEditor = escapeArmed && event.key === 'Tab';
    escapeArmed = false;
    if (leaveEditor) return; // let the browser move focus normally

    const state = editor.getState();
    const multiLine = state.text.slice(state.start, state.end).includes('\n');
    const table = { pad: autoFormatTables() };
    let edit = null;

    // Tables first: each returns null when the caret isn't in a table, and
    // the usual list behaviour below takes over.
    if (event.key === 'Enter' && !event.shiftKey) {
      edit = nextRow(state, table) ?? continueList(state);
    } else if (event.key === 'Tab') {
      const moveInTable = event.shiftKey ? prevCell : nextCell;
      const tableEdit = multiLine ? null : moveInTable(state, table);
      if (tableEdit) edit = tableEdit;
      else if (event.shiftKey) edit = outdentLines(state);
      else if (multiLine || isOnListLine(state)) edit = indentLines(state);
      else edit = { from: state.start, to: state.end, insert: '  ', selectStart: state.start + 2, selectEnd: state.start + 2 };
    }

    if (edit) {
      event.preventDefault();
      editor.applyEdit(edit);
    }
  });
}
