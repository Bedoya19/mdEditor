/**
 * @file DocumentController.js
 * The file workflow: New, Open, Save, Save As, Close — including the
 * "Do you want to save your changes?" question.
 *
 * It coordinates collaborators but implements none of their details:
 *   - MarkdownDocument  → state (text, name, dirty)
 *   - FileService       → how files are read/written (browser or desktop)
 *   - WindowService     → closing the window, if the platform can
 *   - ask()             → how to ask the user (our sheet; could be a native dialog)
 *   - notify()          → how to report results (the status bar)
 * All are injected through the constructor (Dependency Inversion), which is
 * also what makes this class testable with fakes.
 */

import { UNTITLED } from '../model/MarkdownDocument.js';

export class DocumentController {
  /**
   * @param {Object} deps
   * @param {import('../model/MarkdownDocument.js').MarkdownDocument} deps.document
   * @param {import('../platform/FileService.js').FileService} deps.files
   * @param {import('../platform/WindowService.js').WindowService} deps.windowService
   * @param {(options: object) => Promise<string>} deps.ask
   * @param {(message: string, kind?: 'info'|'error') => void} deps.notify
   */
  constructor({ document, files, windowService, ask, notify }) {
    this.document = document;
    this.files = files;
    this.windowService = windowService;
    this.ask = ask;
    this.notify = notify;
    windowService.guardClose({
      hasUnsavedWork: () => document.isDirty,
      requestClose: () => this.close(),
    });
  }

  /** True while the "Save changes?" sheet is open (see #confirmDiscard). */
  #asking = false;

  async newDocument() {
    if (!(await this.#confirmDiscard())) return;
    this.document.load({ content: '', name: UNTITLED });
  }

  async open() {
    if (!(await this.#confirmDiscard())) return;
    await this.#loadFrom(() => this.files.open());
  }

  /**
   * Opens a file handed over from outside (drop, Finder "Open With…").
   * The payload is opaque here — only the FileService understands it.
   *
   * NOTE: `files.openIncoming()` is called BEFORE any `await`, because the
   * browser invalidates a DataTransfer once the drop event returns.
   * @param {any} payload
   */
  async openIncoming(payload) {
    const reading = this.files.openIncoming(payload);
    reading.catch(() => {}); // handled in #loadFrom; avoids an "unhandled rejection" if the user cancels first
    if (!(await this.#confirmDiscard())) return;
    await this.#loadFrom(() => reading);
  }

  /** @returns {Promise<boolean>} true if the document ended up saved. */
  async save() {
    const { name, content, fileRef } = this.document;
    return this.#saveWith(() => this.files.save({ name, content, fileRef }));
  }

  /** @returns {Promise<boolean>} */
  async saveAs() {
    const { name, content } = this.document;
    return this.#saveWith(() => this.files.saveAs({ name, content }));
  }

  /** Red traffic light. Closes the window where possible, else the document. */
  async close() {
    if (!(await this.#confirmDiscard())) return;
    if (this.windowService.capabilities.canClose) this.windowService.close();
    else this.document.load({ content: '', name: UNTITLED });
  }

  /* ───────────────────────── internals ───────────────────────── */

  async #loadFrom(read) {
    try {
      const file = await read();
      if (!file) return; // user cancelled
      this.document.load(file);
      this.notify(`Opened “${file.name}”`);
    } catch (error) {
      this.notify(`Couldn’t open the file: ${error.message}`, 'error');
    }
  }

  async #saveWith(write) {
    try {
      const saved = await write();
      if (!saved) return false; // user cancelled
      this.document.markSaved(saved);
      const verb = this.files.capabilities.canSaveInPlace ? 'Saved' : 'Downloaded';
      this.notify(`${verb} “${saved.name}”`);
      return true;
    } catch (error) {
      this.notify(`Couldn’t save: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * If there are unsaved changes, asks Save / Don't Save / Cancel.
   * @returns {Promise<boolean>} true when it's OK to replace the document.
   */
  async #confirmDiscard() {
    if (!this.document.isDirty) return true;
    // A second request while the sheet is already up (e.g. ⌘W pressed twice
    // via the native menu) is simply refused; the open sheet decides.
    if (this.#asking) return false;
    this.#asking = true;
    try {
      const choice = await this.ask({
        title: `Do you want to save the changes made to “${this.document.name}”?`,
        message: 'Your changes will be lost if you don’t save them.',
        buttons: [
          { id: 'discard', label: 'Don’t Save', role: 'secondary' },
          { id: 'cancel', label: 'Cancel', role: 'cancel' },
          { id: 'save', label: 'Save…', role: 'default' },
        ],
      });
      if (choice === 'save') return await this.save();
      return choice === 'discard';
    } finally {
      this.#asking = false;
    }
  }
}
