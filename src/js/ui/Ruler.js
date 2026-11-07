/**
 * @file Ruler.js
 * TextEdit's measuring ruler. Purely decorative here (Markdown has no tab
 * stops or margins), but it's a strong part of the TextEdit look, so we keep
 * it and let users hide it.
 *
 * Tick marks are drawn by CSS gradients (cheap, crisp); this class only adds
 * the numbers, recomputing them when the window is resized.
 */

const UNIT_PX = 96; // one "inch" at CSS 96 dpi, labelled 0, 1, 2…

export class Ruler {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    this.count = -1;
    new ResizeObserver(() => this.#draw()).observe(root);
  }

  setVisible(visible) {
    this.root.hidden = !visible;
  }

  #draw() {
    const count = Math.ceil(this.root.clientWidth / UNIT_PX);
    if (count === this.count) return; // nothing changed
    this.count = count;
    const labels = Array.from({ length: count }, (_, i) => {
      const span = document.createElement('span');
      span.className = 'ruler__number';
      span.style.left = `${i * UNIT_PX}px`;
      span.textContent = String(i);
      return span;
    });
    this.root.replaceChildren(...labels);
  }
}
