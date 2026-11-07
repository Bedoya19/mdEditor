/**
 * @file DesktopWindowService.js
 * WindowService for the desktop app: a real macOS window, so close,
 * minimise and zoom actually work.
 */

import { WindowService } from '../WindowService.js';

export class DesktopWindowService extends WindowService {
  /** @param {import('./tauriApi.js').TauriApi} api */
  constructor(api) {
    super();
    this.api = api;
  }

  get capabilities() {
    return { canClose: true, canMinimize: true };
  }

  /** The title is hidden in the title bar (we draw our own) but macOS still
   *  shows it in the Window menu, Mission Control and the Dock. */
  setTitle(name, isDirty) {
    this.api.setTitle(`${name}${isDirty ? ' — Edited' : ''}`);
  }

  /** destroy(), not close(): close() would trigger guardClose and ask again. */
  close() {
    this.api.destroyWindow();
  }

  minimize() {
    this.api.minimize();
  }

  toggleMaximize() {
    this.api.toggleMaximize();
  }

  /**
   * Every close attempt (red light, ⌘W, ⌘Q) is cancelled and handed to the
   * app, which shows the "Save changes?" sheet if needed and then calls close().
   */
  guardClose({ requestClose }) {
    this.api.onCloseRequested((event) => {
      event.preventDefault();
      requestClose();
    });
  }
}
