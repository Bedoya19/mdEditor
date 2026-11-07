/**
 * @file createBrowserPlatform.js
 * Factory that assembles the browser flavour of the platform services
 * (the shape is documented in ../Platform.js).
 *
 * Feature detection (not browser sniffing) decides the FileService:
 * if the File System Access API exists we can save in place, otherwise we
 * fall back to downloads.
 *
 * Its sibling, createDesktopPlatform(), returns the same shape. index.js
 * picks one and nothing else in the app changes.
 */

import { FileSystemAccessService } from './FileSystemAccessService.js';
import { DownloadFileService } from './DownloadFileService.js';
import { BrowserWindowService } from './BrowserWindowService.js';
import { DropZone } from './DropZone.js';

/** @returns {import('../Platform.js').Platform} */
export function createBrowserPlatform() {
  const files = 'showOpenFilePicker' in window
    ? new FileSystemAccessService()
    : new DownloadFileService();

  return {
    kind: 'browser',
    files,
    window: new BrowserWindowService(),
    storage: safeLocalStorage(),
    watchDrops: (target, handlers) => new DropZone(target, handlers),
    // No watchOpenRequests / installMenu: a web page has neither.
  };
}

/** Accessing localStorage itself can throw (blocked site data). */
function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
