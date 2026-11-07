/**
 * @file StatusBar.js
 * Bottom bar: word/character counts, caret position, and short messages
 * ("Saved", errors). Pure display — it's told what to show.
 */

const FLASH_MS = 2600;

export class StatusBar {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.statsEl = root.querySelector('[data-role="stats"]');
    this.caretEl = root.querySelector('[data-role="caret"]');
    this.messageEl = root.querySelector('[data-role="message"]');
    this.zoomEl = root.querySelector('[data-role="zoom"]');
    this.hint = '';
    this.timer = null;
  }

  /** @param {{words: number, characters: number}} stats */
  setStats({ words, characters }) {
    const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
    this.statsEl.textContent = `${plural(words, 'word')} · ${plural(characters, 'character')}`;
  }

  /** @param {{line: number, column: number}} position */
  setCaret({ line, column }) {
    this.caretEl.textContent = `Ln ${line}, Col ${column}`;
  }

  /** Shows "125 %" while zoomed (hidden at 100 %). @param {number} zoom */
  setZoom(zoom) {
    this.zoomEl.hidden = zoom === 1;
    this.zoomEl.textContent = `${Math.round(zoom * 100)} %`;
  }

  /** Persistent hint shown when no message is flashing. */
  setHint(text) {
    this.hint = text;
    if (!this.timer) this.messageEl.textContent = text;
  }

  /**
   * Temporary message.
   * @param {string} text
   * @param {'info'|'error'} [kind]
   */
  flash(text, kind = 'info') {
    clearTimeout(this.timer);
    this.messageEl.textContent = text;
    this.messageEl.dataset.kind = kind;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.messageEl.textContent = this.hint;
      delete this.messageEl.dataset.kind;
    }, FLASH_MS);
  }
}
