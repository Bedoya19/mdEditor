/**
 * @file tableSyntax.js
 * The rules of GitHub-style Markdown tables, in ONE place.
 *
 *   | Name  | Qty |     ← header row
 *   | :---- | --: |     ← delimiter row (colons = alignment)
 *   | Apple |   3 |     ← body rows
 *
 * Used by BOTH the parser (markdown/blockRules.js, to render tables) and the
 * table editing tools (editor/tableTransforms.js, to navigate and reformat
 * them), so the two can never disagree about what counts as a cell.
 */

/** A delimiter row: cells made of dashes, optionally with colons at either end. */
export const TABLE_DELIMITER = /^ *\|? *:?-+:? *(\| *:?-+:? *)*\|? *$/;

/**
 * Where each cell's TEXT sits in a row (trimmed, without the pipes).
 *
 * Pipes escaped as `\|` belong to the cell's text. A leading and a trailing
 * pipe are optional in Markdown, so `a | b` and `| a | b |` give the same cells.
 * For an empty cell, start = end = one character after its left pipe, which
 * is where a caret naturally goes.
 *
 * @param {string} line
 * @returns {{start: number, end: number}[]} offsets within `line`
 */
export function cellSpans(line) {
  const pipes = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') { i++; continue; } // skip the escaped character
    if (line[i] === '|') pipes.push(i);
  }

  const edges = [-1, ...pipes, line.length];
  const segments = [];
  for (let i = 0; i < edges.length - 1; i++) segments.push({ from: edges[i] + 1, to: edges[i + 1] });

  // Drop the empty "cells" outside a leading / trailing pipe.
  if (pipes.length && line.slice(0, pipes[0]).trim() === '') segments.shift();
  if (pipes.length && line.slice(pipes.at(-1) + 1).trim() === '') segments.pop();

  return segments.map(({ from, to }) => {
    const text = line.slice(from, to);
    const lead = text.length - text.trimStart().length;
    const content = text.trim();
    if (content === '') {
      const caret = Math.min(from + 1, to);
      return { start: caret, end: caret };
    }
    return { start: from + lead, end: from + lead + content.length };
  });
}

/** The cells' texts of a row: `| a | b |` → ['a', 'b']. */
export function splitRow(line) {
  return cellSpans(line).map(({ start, end }) => line.slice(start, end));
}

/**
 * Alignment of a delimiter cell.
 * @param {string} cell e.g. ':---:'
 * @returns {'left'|'center'|'right'|''}
 */
export function parseAlign(cell) {
  const c = cell.trim();
  if (c.startsWith(':') && c.endsWith(':') && c.length > 1) return 'center';
  if (c.endsWith(':')) return 'right';
  if (c.startsWith(':')) return 'left';
  return '';
}
