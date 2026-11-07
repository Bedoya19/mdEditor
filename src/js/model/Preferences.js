/**
 * @file Preferences.js
 * User settings (view mode, editor font, ruler…) with persistence.
 *
 * DEPENDENCY INVERSION: the storage backend is INJECTED. In the browser we
 * pass `localStorage`; the desktop version could pass a file-backed store
 * with the same `getItem/setItem` shape. This class never references a
 * global directly.
 *
 * EVENTS: "change" → { key, value }
 */

import { Observable } from '../core/Observable.js';

const STORAGE_KEY = 'mdEditor.preferences';

/** Single source of truth for which settings exist and their defaults. */
export const DEFAULT_PREFERENCES = Object.freeze({
  viewMode: 'split',          // 'edit' | 'split' | 'preview'
  editorFont: 'mono',         // key into FONT_STACKS (see ui/EditorView.js)
  fontSize: 14,               // px
  showRuler: true,
});

export class Preferences extends Observable {
  #values;

  /**
   * @param {{getItem(k: string): string|null, setItem(k: string, v: string): void} | null} storage
   */
  constructor(storage) {
    super();
    this.storage = storage;
    this.#values = { ...DEFAULT_PREFERENCES, ...this.#load() };
  }

  /** @param {keyof DEFAULT_PREFERENCES} key */
  get(key) {
    return this.#values[key];
  }

  /**
   * @param {keyof DEFAULT_PREFERENCES} key
   * @param {any} value
   */
  set(key, value) {
    if (!(key in DEFAULT_PREFERENCES)) throw new Error(`Unknown preference "${key}"`);
    if (this.#values[key] === value) return;
    this.#values[key] = value;
    this.#save();
    this.emit('change', { key, value });
  }

  /* Storage can be missing or throw (private windows, blocked cookies):
     preferences then simply don't persist — the app still works. */
  #load() {
    try {
      return JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  #save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.#values));
    } catch { /* non-fatal, see #load */ }
  }
}
