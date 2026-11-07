/**
 * @file MarkdownDocument.js
 * The in-memory model of the file being edited.
 *
 * RESPONSIBILITY: hold the text, the file's name, an opaque reference to
 * where it lives on disk, and whether there are unsaved changes ("dirty").
 * It knows nothing about the DOM, nor about HOW files are read/written —
 * that's the FileService's job.
 *
 * EVENTS
 *  - "content" → text changed                     payload: string
 *  - "state"   → name, file or dirty flag changed  payload: {name, isDirty, hasFile}
 *  - "load"    → a whole new text was loaded (open / new) payload: string
 */

import { Observable } from '../core/Observable.js';

export const UNTITLED = 'Untitled.md';

export class MarkdownDocument extends Observable {
  #content = '';
  #savedContent = '';
  #name = UNTITLED;
  /** Opaque handle given by the FileService (FileSystemFileHandle, path…). */
  #fileRef = null;

  get content() { return this.#content; }
  get name() { return this.#name; }
  get fileRef() { return this.#fileRef; }
  get hasFile() { return this.#fileRef !== null; }
  /** Unsaved changes? Compares against the last saved text, so typing and
   *  then undoing back to the original correctly reports "not dirty". */
  get isDirty() { return this.#content !== this.#savedContent; }

  /** Called on every keystroke by the editor. */
  setContent(text) {
    if (text === this.#content) return;
    const wasDirty = this.isDirty;
    this.#content = text;
    this.emit('content', text);
    if (wasDirty !== this.isDirty) this.#emitState();
  }

  /**
   * Replaces the whole document (after "Open" or "New").
   * @param {{content?: string, name?: string, fileRef?: any}} [file]
   */
  load({ content = '', name = UNTITLED, fileRef = null } = {}) {
    this.#content = content;
    this.#savedContent = content;
    this.#name = name;
    this.#fileRef = fileRef;
    this.emit('load', content);
    this.emit('content', content);
    this.#emitState();
  }

  /**
   * Records a successful save. The FileService may return a new name/handle
   * (e.g. after "Save As…").
   * @param {{name?: string, fileRef?: any}} [saved]
   */
  markSaved({ name = this.#name, fileRef = this.#fileRef } = {}) {
    this.#savedContent = this.#content;
    this.#name = name;
    this.#fileRef = fileRef;
    this.#emitState();
  }

  #emitState() {
    this.emit('state', { name: this.#name, isDirty: this.isDirty, hasFile: this.hasFile });
  }
}
