/**
 * @file tauriApi.js
 * The ONE module that talks to Tauri (`window.__TAURI__`).
 *
 * WHY AN ADAPTER?
 *  - Tauri's JavaScript API can change between major versions. If it does,
 *    this is the only file to update; the desktop services keep calling the
 *    same small, stable functions below.
 *  - The services receive this object as a parameter, so unit tests can pass
 *    a fake one and run in Node without Tauri (see tests/desktop*.test.js).
 *
 * `window.__TAURI__` exists because tauri.conf.json sets
 * `app.withGlobalTauri: true`. Tauri core provides `.core`, `.window`,
 * `.webview`, `.event`, `.menu`; the plugins enabled in src-tauri/src/lib.rs
 * add `.dialog` and `.fs`. Every call is also checked against
 * src-tauri/capabilities/default.json (Tauri refuses anything not listed).
 *
 * @typedef {ReturnType<typeof createTauriApi>} TauriApi
 */

/**
 * @param {any} tauri  Normally `window.__TAURI__`.
 */
export function createTauriApi(tauri) {
  const { core, dialog, fs, event, menu } = tauri;
  const appWindow = tauri.window.getCurrentWindow();
  const appWebview = tauri.webview.getCurrentWebview();

  return {
    /* ── Files ── */

    /** Native "Open" panel. Resolves with an absolute path, or null if cancelled. */
    pickFileToOpen: (filters) => dialog.open({ multiple: false, directory: false, filters }),

    /** Native "Save" panel. Resolves with an absolute path, or null if cancelled. */
    pickFileToSave: (defaultPath, filters) => dialog.save({ defaultPath, filters }),

    readTextFile: (path) => fs.readTextFile(path),
    writeTextFile: (path, text) => fs.writeTextFile(path, text),

    /* ── Window ── */

    setTitle: (title) => appWindow.setTitle(title),
    /** Closes WITHOUT firing the close-requested event (plain close() would ask again). */
    destroyWindow: () => appWindow.destroy(),
    minimize: () => appWindow.minimize(),
    toggleMaximize: () => appWindow.toggleMaximize(),
    /** handler(event): call event.preventDefault() to keep the window open. */
    onCloseRequested: (handler) => appWindow.onCloseRequested(handler),

    /* ── Drag & drop (native: gives real paths) ── */

    /** handler({type: 'enter'|'over'|'drop'|'leave', paths?: string[]}) */
    onDragDrop: (handler) => appWebview.onDragDropEvent((e) => handler(e.payload)),

    /* ── Finder "Open With…" (see src-tauri/src/lib.rs) ── */

    /** Collects (and clears) the files macOS asked us to open. */
    takePendingFiles: () => core.invoke('take_pending_files'),
    /** Fired when new files are waiting; then call takePendingFiles(). */
    onOpenFilesPending: (handler) => event.listen('open-files-pending', handler),

    /* ── Native menu bar ── */

    /**
     * Builds the macOS menu bar from plain data (see DesktopMenu.js).
     * @param {{title: string, items: object[]}[]} spec
     * @param {(item: object) => void} onSelect  Called with the clicked item.
     * @returns {Promise<{checkItems: {prefKey: string, setChecked: (on: boolean) => Promise<void>}[]}>}
     *   Handles to update check marks later.
     */
    async setAppMenu(spec, onSelect) {
      const { Menu, Submenu, MenuItem, CheckMenuItem, PredefinedMenuItem } = menu;
      const checkItems = [];
      const toNative = async (item) => {
        if (item.separator) return PredefinedMenuItem.new({ item: 'Separator' });
        if (item.predefined) return PredefinedMenuItem.new({ item: item.predefined, text: item.label });
        if (item.items) return Submenu.new({ text: item.title, items: await Promise.all(item.items.map(toNative)) });
        const options = { id: item.id, text: item.label, accelerator: item.accelerator, action: () => onSelect(item) };
        if (!item.check) return MenuItem.new(options);
        const native = await CheckMenuItem.new({ ...options, checked: item.checked });
        checkItems.push({ prefKey: item.check, setChecked: (on) => native.setChecked(on) });
        return native;
      };
      const submenus = await Promise.all(spec.map(async ({ title, items }) =>
        Submenu.new({ text: title, items: await Promise.all(items.map(toNative)) })));
      const bar = await Menu.new({ items: submenus });
      await bar.setAsAppMenu();
      return { checkItems };
    },
  };
}
