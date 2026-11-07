/**
 * @file smartKeys.js
 * Writer-friendly keyboard behaviour inside the editor:
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

/**
 * @param {import('../ui/EditorView.js').EditorView} editor
 */
export function attachSmartKeys(editor) {
  let escapeArmed = false;

  editor.textarea.addEventListener('keydown', (event) => {
    if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === 'Escape') { escapeArmed = true; return; }
    const leaveEditor = escapeArmed && event.key === 'Tab';
    escapeArmed = false;
    if (leaveEditor) return; // let the browser move focus normally

    const state = editor.getState();
    let edit = null;

    if (event.key === 'Enter' && !event.shiftKey) {
      edit = continueList(state);
    } else if (event.key === 'Tab' && event.shiftKey) {
      edit = outdentLines(state);
    } else if (event.key === 'Tab') {
      const multiLine = state.text.slice(state.start, state.end).includes('\n');
      edit = multiLine || isOnListLine(state)
        ? indentLines(state)
        : { from: state.start, to: state.end, insert: '  ', selectStart: state.start + 2, selectEnd: state.start + 2 };
    }

    if (edit) {
      event.preventDefault();
      editor.applyEdit(edit);
    }
  });
}
