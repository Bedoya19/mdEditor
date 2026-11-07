/**
 * @file TableSizePicker.js
 * The Pages/Word-style grid for choosing a new table's size: hover (or move
 * with the arrow keys) to highlight "3 columns × 4 rows", click to insert.
 *
 * Every cell is a real <button data-command="table.insert" data-arg="3x4">,
 * so the click is handled by the Toolbar like any other command, and the
 * buttons work with the keyboard and screen readers. This class only builds
 * the grid and does the highlighting.
 *
 * Only one cell is in the Tab order at a time ("roving tabindex"); the arrow
 * keys move between cells. Otherwise Tab would have to cross 48 buttons.
 */

const COLUMNS = 8;
const ROWS = 6; // including the header row

export class TableSizePicker {
  /** @param {HTMLElement} root  Empty container (`[data-role="table-picker"]`). */
  constructor(root) {
    this.root = root;
    this.label = Object.assign(document.createElement('div'), { className: 'table-picker__label' });
    this.grid = Object.assign(document.createElement('div'), { className: 'table-picker__grid' });
    this.grid.setAttribute('role', 'group');
    this.grid.setAttribute('aria-label', 'Insert table: choose a size');
    this.cells = [];

    for (let row = 1; row <= ROWS; row++) {
      for (let col = 1; col <= COLUMNS; col++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'table-picker__cell';
        cell.dataset.command = 'table.insert';
        cell.dataset.arg = `${col}x${row}`;
        cell.dataset.col = String(col);
        cell.dataset.row = String(row);
        cell.tabIndex = row === 1 && col === 1 ? 0 : -1;
        cell.setAttribute('aria-label', `${col} ${col === 1 ? 'column' : 'columns'} × ${row} rows`);
        this.cells.push(cell);
      }
    }
    this.grid.replaceChildren(...this.cells);
    root.replaceChildren(this.label, this.grid);

    this.grid.addEventListener('pointerover', (e) => this.#highlightFrom(e.target));
    this.grid.addEventListener('focusin', (e) => this.#highlightFrom(e.target));
    this.grid.addEventListener('pointerleave', () => this.#highlight(0, 0));
    this.grid.addEventListener('keydown', (e) => this.#move(e));
    this.#highlight(0, 0);
  }

  #highlightFrom(target) {
    const cell = target.closest('.table-picker__cell');
    if (cell) this.#highlight(Number(cell.dataset.col), Number(cell.dataset.row));
  }

  #highlight(cols, rows) {
    for (const cell of this.cells) {
      cell.classList.toggle('is-on', Number(cell.dataset.col) <= cols && Number(cell.dataset.row) <= rows);
    }
    this.label.textContent = cols
      ? `${cols} ${cols === 1 ? 'column' : 'columns'} × ${rows} rows`
      : 'Insert Table';
  }

  #move(event) {
    const deltas = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    const delta = deltas[event.key];
    const current = event.target.closest('.table-picker__cell');
    if (!delta || !current) return;
    event.preventDefault();
    const col = Math.min(COLUMNS, Math.max(1, Number(current.dataset.col) + delta[0]));
    const row = Math.min(ROWS, Math.max(1, Number(current.dataset.row) + delta[1]));
    const next = this.cells[(row - 1) * COLUMNS + (col - 1)];
    current.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  }
}
