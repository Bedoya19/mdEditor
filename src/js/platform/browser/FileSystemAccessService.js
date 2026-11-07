/**
 * @file FileSystemAccessService.js
 * FileService for Chromium browsers (Chrome, Edge, Brave, Arc, Opera).
 *
 * Uses the File System Access API, which gives real file handles: after you
 * open a file, "Save" writes back to THE SAME FILE on disk — the closest a
 * web page gets to a desktop app.
 * https://developer.mozilla.org/docs/Web/API/File_System_API
 */

import { FileService, MARKDOWN_EXTENSIONS, isAbort } from '../FileService.js';

const PICKER_TYPES = [{
  description: 'Markdown documents',
  accept: { 'text/markdown': MARKDOWN_EXTENSIONS },
}];

export class FileSystemAccessService extends FileService {
  get capabilities() {
    return { canSaveInPlace: true };
  }

  async open() {
    try {
      const [handle] = await window.showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
      return this.#read(handle);
    } catch (error) {
      if (isAbort(error)) return null;
      throw error;
    }
  }

  openIncoming(dataTransfer) {
    // Both calls happen synchronously, while the drop event is still alive.
    const item = [...dataTransfer.items].find((i) => i.kind === 'file');
    if (!item) return Promise.resolve(null);
    const handlePromise = item.getAsFileSystemHandle?.() ?? Promise.resolve(null);
    const file = item.getAsFile();

    return handlePromise.then((handle) =>
      handle?.kind === 'file'
        ? this.#read(handle)
        : file.text().then((content) => ({ name: file.name, content, fileRef: null })),
    );
  }

  async save({ name, content, fileRef }) {
    if (!fileRef) return this.saveAs({ name, content });
    await this.#ensureWritePermission(fileRef);
    await this.#write(fileRef, content);
    return { name: fileRef.name, fileRef };
  }

  async saveAs({ name, content }) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: name, types: PICKER_TYPES });
      await this.#write(handle, content);
      return { name: handle.name, fileRef: handle };
    } catch (error) {
      if (isAbort(error)) return null;
      throw error;
    }
  }

  async #read(handle) {
    const file = await handle.getFile();
    return { name: file.name, content: await file.text(), fileRef: handle };
  }

  async #write(handle, content) {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /** Files opened read-only (e.g. via drag & drop) need explicit permission to write. */
  async #ensureWritePermission(handle) {
    const opts = { mode: 'readwrite' };
    if ((await handle.queryPermission?.(opts)) === 'granted') return;
    if ((await handle.requestPermission?.(opts)) !== 'granted') {
      throw new Error('Permission to write the file was denied.');
    }
  }
}
