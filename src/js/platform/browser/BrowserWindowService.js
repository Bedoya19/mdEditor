/**
 * @file BrowserWindowService.js
 * WindowService for a browser tab.
 *
 * A web page can't close or minimise its own tab, so those capabilities are
 * false (the controller then treats the red button as "close document").
 * "Zoom" (green button) maps to the Fullscreen API.
 */

import { WindowService } from '../WindowService.js';

const APP_NAME = 'Markdown Editor';

export class BrowserWindowService extends WindowService {
  get capabilities() {
    return { canClose: false, canMinimize: false };
  }

  setTitle(name, isDirty) {
    document.title = `${isDirty ? '• ' : ''}${name} — ${APP_NAME}`;
  }

  toggleMaximize() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  /** Browsers can only show their own generic prompt, so `requestClose` is unused. */
  guardClose({ hasUnsavedWork }) {
    window.addEventListener('beforeunload', (event) => {
      if (!hasUnsavedWork()) return;
      event.preventDefault();
      event.returnValue = ''; // required by some browsers to show the prompt
    });
  }
}
