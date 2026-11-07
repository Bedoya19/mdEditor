/**
 * @file Workspace.js
 * Applies VIEW preferences to the page: which panes are visible
 * (edit / split / preview) and the editor font. Everything visual is done in
 * CSS; this class only flips attributes and CSS custom properties, keeping
 * layout rules out of JavaScript.
 */

import { EDITOR_FONTS } from './fonts.js';

export const VIEW_MODES = ['edit', 'split', 'preview'];

export class Workspace {
  /** @param {HTMLElement} root  The <main class="workspace">. */
  constructor(root) {
    this.root = root;
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

  /**
   * Sets the font size AND a whole-pixel line height. The source paper draws
   * notebook-style ruled lines every `--editor-line` px; a rounded value keeps
   * the lines aligned with the text even after hundreds of lines (fractional
   * line heights would slowly drift).
   * @param {number} px
   */
  setFontSize(px) {
    const size = Number(px);
    this.root.style.setProperty('--editor-font-size', `${size}px`);
    this.root.style.setProperty('--editor-line', `${Math.round(size * 1.7)}px`);
  }
}
