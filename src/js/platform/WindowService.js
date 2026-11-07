/**
 * @file WindowService.js
 * ABSTRACT contract for the window the app lives in.
 *
 * In a browser tab, "close" or "minimize" mostly can't be done by a page; in
 * a desktop shell they map to real OS window operations. The traffic-light
 * buttons and the controller only talk to this contract, so they work the
 * same in both worlds (see FileService.js for the reasoning behind
 * abstract classes here).
 */
export class WindowService {
  /** @returns {{canClose: boolean, canMinimize: boolean}} */
  get capabilities() {
    return { canClose: false, canMinimize: false };
  }

  /**
   * Update the OS/tab title.
   * @param {string} name  Document name.
   * @param {boolean} isDirty
   */
  setTitle(name, isDirty) {
    throw new Error(`${this.constructor.name}.setTitle() not implemented`);
  }

  /** Close the window (only if capabilities.canClose). */
  close() {}

  /** Minimise the window (only if capabilities.canMinimize). */
  minimize() {}

  /** Toggle maximised / full-screen. */
  toggleMaximize() {}

  /**
   * Protects unsaved work when the user closes the window/tab by other means
   * than our red button (⌘W, ⌘Q, the tab's ×…). Each platform uses whichever
   * callback it can honour:
   *  - browser: `hasUnsavedWork` → the browser's generic "Leave site?" prompt
   *    (a page may not show its own UI while a tab closes);
   *  - desktop: `requestClose`  → the close is cancelled and handed to the app,
   *    which shows our own "Save changes?" sheet and then calls `close()`.
   * @param {{hasUnsavedWork: () => boolean, requestClose: () => void}} handlers
   */
  guardClose(handlers) {}
}
