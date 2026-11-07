/**
 * @file Workspace.js
 * Applies VIEW preferences to the page: which panes are visible
 * (edit / split / preview) and the editor font. Everything visual is done in
 * CSS; this class only flips attributes and CSS custom properties, keeping
 * layout rules out of JavaScript.
 */

import { EDITOR_FONTS } from './fonts.js';

export const VIEW_MODES = ['edit', 'split', 'preview'];

/** Zoom levels for ⌘+ / ⌘− (like TextEdit's View › Zoom). 1 = 100 %. */
export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
export const ZOOM_RANGE = { min: ZOOM_STEPS[0], max: ZOOM_STEPS.at(-1) };

/** Keeps a zoom value in range, rounded to whole percent (for pinch zoom). */
export const clampZoom = (zoom) =>
  Math.round(Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, zoom)) * 100) / 100;

/**
 * Next zoom step up (+1) or down (-1) from any value, including in-between
 * values left by pinch zoom (1.13 → zoom in goes to 1.25, not 1.1).
 */
export function stepZoom(current, direction) {
  const next = direction > 0
    ? ZOOM_STEPS.find((z) => z > current + 1e-9)
    : [...ZOOM_STEPS].reverse().find((z) => z < current - 1e-9);
  return next ?? current;
}

export class Workspace {
  /** @param {HTMLElement} root  The <main class="workspace">. */
  constructor(root) {
    this.root = root;
    this.fontSize = 14;
    this.zoom = 1;
  }

  /** @param {'edit'|'split'|'preview'} mode  Read by CSS: .workspace[data-view="…"] */
  setViewMode(mode) {
    this.root.dataset.view = VIEW_MODES.includes(mode) ? mode : 'split';
  }

  /** @param {keyof EDITOR_FONTS} key */
  setEditorFont(key) {
    const font = EDITOR_FONTS[key] ?? EDITOR_FONTS.mono;
    this.root.style.setProperty('--editor-font', font.stack);
  }

  /** @param {number} px  Text column width at 100 % zoom (CSS: --text-width). */
  setTextWidth(px) {
    this.root.style.setProperty('--text-width', `${Number(px)}px`);
  }

  /** @param {number} px  Editor font size at 100 % zoom. */
  setFontSize(px) {
    this.fontSize = Number(px);
    this.#applyEditorType();
  }

  /**
   * Magnifies the pages (text, margins, ruler, column width), not the
   * toolbar, like TextEdit's zoom. Most sizes follow `--zoom` in CSS.
   * @param {number} zoom  1 = 100 %
   */
  setZoom(zoom) {
    this.zoom = Number(zoom);
    this.root.style.setProperty('--zoom', String(this.zoom));
    this.#applyEditorType();
  }

  /**
   * Editor font size × zoom, and a WHOLE-PIXEL line height. The notebook
   * paper draws a rule every `--editor-line` px; a rounded value keeps the
   * rules aligned with the text even after hundreds of lines (fractional
   * line heights would slowly drift). That's why this is computed here and
   * not with calc() in CSS.
   */
  #applyEditorType() {
    const size = this.fontSize * this.zoom;
    this.root.style.setProperty('--editor-font-size', `${size}px`);
    this.root.style.setProperty('--editor-line', `${Math.round(size * 1.7)}px`);
  }
}
