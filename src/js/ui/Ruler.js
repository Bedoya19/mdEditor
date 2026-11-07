/**
 * @file Ruler.js
 * A TextEdit/Pages-style ruler on top of a sheet, whose two margin markers
 * set the WIDTH OF THE TEXT COLUMN (line length, the biggest factor in how
 * comfortable text is to read).
 *
 * WHO DOES WHAT
 *  - CSS (ruler.css / workspace.css) does all the geometry: the sheet's width
 *    comes from `--text-width`, the markers sit `--sheet-pad` from each edge,
 *    and the ticks are gradients. So the markers ALWAYS sit exactly on the
 *    text column's edges, without measuring anything.
 *  - This class only adds the inch numbers and turns marker drags / key
 *    presses into a new width, reported through `onWidthChange`.
 *  - It never touches preferences itself: the caller decides where the value
 *    lives (index.js stores it in Preferences, so both sheets share it).
 *
 * The sheet is centred, so dragging one marker by `dx` changes the width by
 * `2 × dx`: both margins move together and the marker stays under the pointer.
 */

export const INCH_PX = 96; // CSS inch

/** Allowed text widths: 3″ to 14″, in steps of ⅛″. */
export const TEXT_WIDTH = { min: 3 * INCH_PX, max: 14 * INCH_PX, step: INCH_PX / 8 };

/** Snaps to ⅛″ and keeps the width inside the allowed range. */
export function clampWidth(px) {
  const snapped = Math.round(px / TEXT_WIDTH.step) * TEXT_WIDTH.step;
  return Math.min(TEXT_WIDTH.max, Math.max(TEXT_WIDTH.min, snapped));
}

/**
 * New width after dragging a marker.
 * @param {{startWidth: number, dx: number, side: 'left'|'right', zoom?: number}} drag
 *   dx in screen px. At 200 % zoom a screen pixel is half a "document" pixel.
 */
export function widthAfterDrag({ startWidth, dx, side, zoom = 1 }) {
  const outward = side === 'right' ? dx : -dx;
  return clampWidth(startWidth + (2 * outward) / zoom);
}

/** "7.5″" style label. */
export const formatInches = (px) => `${+(px / INCH_PX).toFixed(3)}″`;

export class Ruler {
  /**
   * @param {HTMLElement} root  The `.ruler` element (inside a `.page`).
   * @param {Object} options
   * @param {() => number} options.getWidth            Current text width (px, unzoomed).
   * @param {(px: number) => void} options.onWidthChange
   * @param {() => void} options.onReset               Double-click on a marker.
   */
  constructor(root, { getWidth, onWidthChange, onReset }) {
    this.root = root;
    this.getWidth = getWidth;
    this.onWidthChange = onWidthChange;
    this.onReset = onReset;
    this.zoom = 1;
    this.count = -1;

    this.scale = Object.assign(document.createElement('div'), { className: 'ruler__scale' });
    this.markers = ['left', 'right'].map((side) => this.#createMarker(side));
    root.replaceChildren(this.scale, ...this.markers);

    new ResizeObserver(() => this.#drawNumbers()).observe(root);
  }

  setVisible(visible) {
    this.root.hidden = !visible;
  }

  /** Called when zoom changes: one ruler inch becomes 96 × zoom screen px. */
  setZoom(zoom) {
    this.zoom = zoom;
    this.count = -1; // force redraw
    this.#drawNumbers();
  }

  /** Refreshes the accessible value after the width changed elsewhere. */
  refresh() {
    const width = this.getWidth();
    for (const marker of this.markers) {
      marker.setAttribute('aria-valuenow', String(width));
      marker.setAttribute('aria-valuetext', `Text width ${formatInches(width)}`);
      marker.title = `Text width: ${formatInches(width)} (drag to change, double-click to reset)`;
    }
  }

  /**
   * Numbers 0, 1, 2… start at the LEFT TEXT EDGE (like Pages), so they read
   * as "how wide is my text". Positions are pure CSS calc(), so they stay
   * correct as the sheet resizes; we only recompute HOW MANY to draw.
   */
  #drawNumbers() {
    const unit = INCH_PX * this.zoom;
    const count = Math.max(0, Math.ceil(this.root.clientWidth / unit));
    if (count === this.count) return;
    this.count = count;
    const numbers = Array.from({ length: count }, (_, i) => {
      const span = document.createElement('span');
      span.className = 'ruler__number';
      span.style.left = `calc(var(--sheet-pad) + ${i} * var(--ruler-unit))`;
      span.textContent = String(i);
      return span;
    });
    this.scale.replaceChildren(...numbers);
  }

  #createMarker(side) {
    const marker = document.createElement('div');
    marker.className = `ruler__marker ruler__marker--${side}`;
    marker.tabIndex = 0;
    marker.setAttribute('role', 'slider');
    marker.setAttribute('aria-label', `${side === 'left' ? 'Left' : 'Right'} margin`);
    marker.setAttribute('aria-valuemin', String(TEXT_WIDTH.min));
    marker.setAttribute('aria-valuemax', String(TEXT_WIDTH.max));

    // Drag with the mouse/trackpad. Pointer capture keeps the drag going even
    // if the pointer leaves the little marker.
    marker.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      marker.setPointerCapture(event.pointerId);
      const start = { x: event.clientX, width: this.getWidth() };
      this.root.classList.add('is-dragging');

      const move = (e) => {
        const width = widthAfterDrag({ startWidth: start.width, dx: e.clientX - start.x, side, zoom: this.zoom });
        if (width !== this.getWidth()) this.onWidthChange(width);
      };
      const end = () => {
        this.root.classList.remove('is-dragging');
        marker.removeEventListener('pointermove', move);
      };
      marker.addEventListener('pointermove', move);
      marker.addEventListener('pointerup', end, { once: true });
      marker.addEventListener('pointercancel', end, { once: true });
    });

    marker.addEventListener('dblclick', () => this.onReset());

    // Keyboard: arrows move the marker ⅛″ (Shift: 1″). Moving a marker
    // outward widens the column, inward narrows it.
    marker.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? INCH_PX : TEXT_WIDTH.step;
      const outward = { ArrowRight: side === 'right' ? 1 : -1, ArrowLeft: side === 'left' ? 1 : -1 }[event.key];
      let width;
      if (outward) width = this.getWidth() + outward * 2 * step;
      else if (event.key === 'Home') width = TEXT_WIDTH.min;
      else if (event.key === 'End') width = TEXT_WIDTH.max;
      else return;
      event.preventDefault();
      this.onWidthChange(clampWidth(width));
    });

    return marker;
  }
}
