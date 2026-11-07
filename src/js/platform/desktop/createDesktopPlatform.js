/**
 * @file createDesktopPlatform.js
 * Factory for the desktop (Tauri) flavour of the platform services.
 * Returns the same shape as createBrowserPlatform() (see ../Platform.js),
 * plus the two desktop-only extras: Finder "Open With…" and the menu bar.
 *
 * index.js only loads this file when it runs inside Tauri (dynamic import),
 * so the browser version never downloads any of the desktop code.
 */

import { createTauriApi } from './tauriApi.js';
import { DesktopFileService } from './DesktopFileService.js';
import { DesktopWindowService } from './DesktopWindowService.js';
import { installDesktopMenu } from './DesktopMenu.js';

/**
 * @param {any} [tauri]  Defaults to the global Tauri API.
 * @returns {import('../Platform.js').Platform}
 */
export function createDesktopPlatform(tauri = window.__TAURI__) {
  const api = createTauriApi(tauri);

  return {
    kind: 'desktop',
    files: new DesktopFileService(api),
    window: new DesktopWindowService(api),
    // The app's web view keeps its own persistent localStorage, so the
    // Preferences class works unchanged.
    storage: window.localStorage,

    /** Native drops give real paths → a dropped file can be saved in place. */
    watchDrops(_target, { onHover, onDrop }) {
      api.onDragDrop(({ type, paths }) => {
        if (type === 'enter' || type === 'over') onHover(true);
        else if (type === 'leave') onHover(false);
        else if (type === 'drop') {
          onHover(false);
          onDrop(paths);
        }
      });
    },

    /**
     * Files sent by Finder. The native side keeps a waiting list (see
     * src-tauri/src/lib.rs); we collect it once at startup (files that
     * arrived before the page loaded) and again whenever it says more arrived.
     */
    watchOpenRequests(onOpen) {
      const collect = async () => {
        const paths = await api.takePendingFiles();
        if (paths.length) onOpen(paths);
      };
      api.onOpenFilesPending(collect);
      collect();
    },

    installMenu: ({ commands, keymap, isChecked }) => installDesktopMenu(api, commands, keymap, isChecked),
  };
}
