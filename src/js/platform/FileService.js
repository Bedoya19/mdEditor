/**
 * @file FileService.js
 * ABSTRACT contract for reading and writing files.
 *
 * WHY AN ABSTRACT CLASS IN JAVASCRIPT?
 * JS has no `interface` keyword. A base class whose methods throw
 * "not implemented" documents the contract in code, and makes a missing
 * method fail loudly instead of silently doing nothing.
 *
 * DEPENDENCY INVERSION (the "D" in SOLID)
 * The DocumentController depends on THIS abstraction, never on a concrete
 * browser or desktop API. Today we plug in a browser implementation; the
 * desktop version plugs in one that talks to the OS (Electron/Tauri) and
 * nothing else in the app changes.
 *
 * LISKOV SUBSTITUTION (the "L")
 * Every implementation must honour the same promises:
 *   - resolve `null` when the user CANCELS a picker (never throw for that);
 *   - throw only for real failures (permission denied, disk error…);
 *   - treat `fileRef` as opaque — only the service that created it reads it.
 *
 * @typedef {Object} OpenedFile
 * @property {string} name     File name shown to the user ("notes.md").
 * @property {string} content  UTF-8 text.
 * @property {any}    fileRef  Opaque handle used to save back in place (or null).
 *
 * @typedef {Object} SavedFile
 * @property {string} name
 * @property {any}    fileRef
 */
export class FileService {
  /**
   * What this implementation can do, so the UI can adapt its wording.
   * `canSaveInPlace: false` means "Save" will download a copy instead.
   * @returns {{canSaveInPlace: boolean}}
   */
  get capabilities() {
    return { canSaveInPlace: false };
  }

  /** Ask the user for a file. @returns {Promise<OpenedFile|null>} */
  async open() {
    throw new Error(`${this.constructor.name}.open() not implemented`);
  }

  /**
   * Read a file handed to the app FROM OUTSIDE: dragged onto the window, or
   * (desktop) sent by Finder's "Open With…".
   *
   * The payload is OPAQUE, like `fileRef`: the platform that produced it is
   * the only one that reads it. The browser passes a DataTransfer, the
   * desktop passes an array of file paths. The controller just forwards it.
   *
   * Browser note: must START reading synchronously, because browsers
   * invalidate a DataTransfer as soon as the drop event returns.
   * @param {any} payload
   * @returns {Promise<OpenedFile|null>}
   */
  async openIncoming(payload) {
    throw new Error(`${this.constructor.name}.openIncoming() not implemented`);
  }

  /**
   * Write `content` back to `fileRef` (or behave like saveAs if there's none).
   * @param {{name: string, content: string, fileRef: any}} file
   * @returns {Promise<SavedFile|null>}
   */
  async save(file) {
    throw new Error(`${this.constructor.name}.save() not implemented`);
  }

  /**
   * Ask the user where to save.
   * @param {{name: string, content: string}} file
   * @returns {Promise<SavedFile|null>}
   */
  async saveAs(file) {
    throw new Error(`${this.constructor.name}.saveAs() not implemented`);
  }
}

/** File types offered in pickers. Shared by every implementation. */
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.txt'];

/** True for the user pressing "Cancel" in a native picker. */
export const isAbort = (error) => error?.name === 'AbortError';
