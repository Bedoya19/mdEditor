/**
 * @file DownloadFileService.js
 * FileService fallback for Safari and Firefox (no File System Access API).
 *
 *  - Open: a hidden <input type="file">.
 *  - Save: the file is DOWNLOADED (browsers don't let pages overwrite files
 *    without that API). `capabilities.canSaveInPlace` is false so the UI can
 *    tell the user.
 *
 * Because it honours the same contract as FileSystemAccessService (null on
 * cancel, same return shapes), the rest of the app can't tell them apart —
 * Liskov Substitution in practice.
 */

import { FileService, MARKDOWN_EXTENSIONS } from '../FileService.js';

export class DownloadFileService extends FileService {
  get capabilities() {
    return { canSaveInPlace: false };
  }

  open() {
    return new Promise((resolve, reject) => {
      const input = Object.assign(document.createElement('input'), {
        type: 'file',
        accept: [...MARKDOWN_EXTENSIONS, 'text/markdown', 'text/plain'].join(','),
      });
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        file.text().then((content) => resolve({ name: file.name, content, fileRef: null }), reject);
      });
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }

  async openIncoming(dataTransfer) {
    const file = dataTransfer.files?.[0];
    if (!file) return null;
    return { name: file.name, content: await file.text(), fileRef: null };
  }

  async save(file) {
    return this.saveAs(file);
  }

  async saveAs({ name, content }) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(link);
    link.click();
    link.remove();
    // Give the browser a moment to start the download before freeing memory.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { name, fileRef: null };
  }
}
