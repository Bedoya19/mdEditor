/**
 * @file documentStats.js
 * Pure helpers computing the numbers shown in the status bar.
 * Kept apart from the document model so the model stays focused on state.
 */

/**
 * @param {string} text
 * @returns {{words: number, characters: number, lines: number}}
 */
export function countStats(text) {
  const trimmed = text.trim();
  return {
    words: trimmed === '' ? 0 : trimmed.split(/\s+/u).length,
    characters: [...text].length, // spread counts emoji as 1, not 2
    lines: text === '' ? 1 : text.split('\n').length,
  };
}

/**
 * Converts a character offset into a 1-based line/column (for "Ln 3, Col 7").
 * @param {string} text
 * @param {number} offset
 */
export function cursorPosition(text, offset) {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - before.lastIndexOf('\n');
  return { line, column };
}
