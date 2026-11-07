/**
 * @file DesktopFileService.js
 * FileService for the desktop app: native Open/Save panels and real file
 * reads/writes through Tauri (via the tauriApi adapter).
 *
 * `fileRef` is simply the file's absolute path, so "Save" always writes back
 * to the same file, in every case: opened with ⌘O, dropped on the window,
 * or opened from Finder.
 *
 * It honours the FileService contract exactly like the browser services
 * (null on cancel, errors only for real failures), so DocumentController
 * works unchanged: Liskov Substitution.
 */

import { FileService, MARKDOWN_EXTENSIONS } from '../FileService.js';

/** Filters for the native panels: ["md", "markdown", …] (no leading dots). */
const FILTERS = [{ name: 'Markdown', extensions: MARKDOWN_EXTENSIONS.map((ext) => ext.slice(1)) }];

const basename = (path) => path.split(/[\\/]/).pop();
const isTextFile = (path) => MARKDOWN_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));

export class DesktopFileService extends FileService {
  /** @param {import('./tauriApi.js').TauriApi} api */
  constructor(api) {
    super();
    this.api = api;
  }

  get capabilities() {
    return { canSaveInPlace: true };
  }

  async open() {
    const path = await this.api.pickFileToOpen(FILTERS);
    return path ? this.#read(path) : null;
  }

  /**
   * @param {string[]} paths  From a native drop or Finder "Open With…".
   *   Single-window app: the first Markdown/text file wins.
   */
  async openIncoming(paths) {
    if (!paths?.length) return null;
    const path = paths.find(isTextFile);
    if (!path) throw new Error('only Markdown or plain-text files can be opened');
    return this.#read(path);
  }

  async save({ name, content, fileRef }) {
    if (!fileRef) return this.saveAs({ name, content });
    await this.api.writeTextFile(fileRef, content);
    return { name: basename(fileRef), fileRef };
  }

  async saveAs({ name, content }) {
    const chosen = await this.api.pickFileToSave(name, FILTERS);
    if (!chosen) return null;
    // Typing "notes" in the panel shouldn't create a file with no extension.
    const path = isTextFile(chosen) ? chosen : `${chosen}.md`;
    await this.api.writeTextFile(path, content);
    return { name: basename(path), fileRef: path };
  }

  async #read(path) {
    const content = await this.api.readTextFile(path);
    return { name: basename(path), content, fileRef: path };
  }
}
