/**
 * @file desktop.js — end-to-end checks of the DESKTOP wiring, without Tauri.
 *
 * Before the app loads, we inject a FAKE `window.__TAURI__` with an
 * in-memory disk that records every native call. The page then takes the
 * real desktop code path (index.js → createDesktopPlatform → tauriApi →
 * services → menu), so this verifies everything OUR code does in the desktop
 * app: menu, shortcuts owned by the menu, Open With, drag & drop, close guard.
 *
 * What it can't verify is Tauri itself (native panels, real disk, real
 * traffic lights). That's the short manual checklist in docs/DESKTOP.md.
 */
import { openApp, createChecks, sleep } from './harness.js';

/** Runs in the page before the app. Keep it plain ES2020 (it's injected as a string). */
const FAKE_TAURI = `(() => {
  const fake = {
    log: [],
    disk: {
      '/Users/me/notes.md': '# Notes\\n\\nhello',
      '/Users/me/other.md': '# Other',
    },
    pending: ['/Users/me/notes.md'], // as if the app was launched by double-clicking notes.md
    handlers: {},
    menuItems: {},
    submenus: [],
    dialog: { open: null, save: null },
  };
  window.__fake = fake;
  const appWindow = {
    setTitle: async (t) => { fake.log.push('title: ' + t); },
    destroy: async () => { fake.log.push('destroy'); },
    minimize: async () => {},
    toggleMaximize: async () => {},
    onCloseRequested: async (h) => { fake.handlers.close = h; },
  };
  window.__TAURI__ = {
    core: { invoke: async (cmd) => (cmd === 'take_pending_files' ? fake.pending.splice(0) : null) },
    window: { getCurrentWindow: () => appWindow },
    webview: { getCurrentWebview: () => ({ onDragDropEvent: async (h) => { fake.handlers.drag = h; } }) },
    event: { listen: async (name, h) => { fake.handlers[name] = h; } },
    dialog: { open: async () => fake.dialog.open, save: async () => fake.dialog.save },
    fs: {
      readTextFile: async (p) => { if (!(p in fake.disk)) throw new Error('not found'); return fake.disk[p]; },
      writeTextFile: async (p, t) => { fake.disk[p] = t; fake.log.push('write: ' + p); },
    },
    menu: {
      Menu: { new: async (o) => ({ ...o, setAsAppMenu: async () => { fake.log.push('menu installed'); } }) },
      Submenu: { new: async (o) => { fake.submenus.push(o.text); return o; } },
      MenuItem: { new: async (o) => { fake.menuItems[o.id] = o; return o; } },
      CheckMenuItem: { new: async (o) => {
        const item = { ...o, setChecked: async (on) => { item.checked = on; } };
        fake.menuItems[o.id] = item;
        return item;
      } },
      PredefinedMenuItem: { new: async (o) => o },
    },
  };
})();`;

export async function runDesktopChecks() {
  const app = await openApp({ appPort: 8098, debugPort: 9338, initScript: FAKE_TAURI });
  const { js, press, type, select } = app;
  const { check, report } = createChecks('Desktop wiring (fake Tauri)');
  const clickSheet = (choice) => js(`[...document.querySelectorAll("#sheet button")].find((b) => b.value === "${choice}").click()`);
  const menu = (id) => js(`window.__fake.menuItems["${id}"].action()`);

  check('desktop platform detected', await js('document.documentElement.dataset.platform'), 'desktop');
  check('CSS traffic lights hidden (macOS draws the real ones)',
    await js('getComputedStyle(document.querySelector(".traffic-lights")).display'), 'none');
  check('native menu installed', await js('window.__fake.log.includes("menu installed")'), true);
  check('menu item has label + shortcut from the keymap',
    await js('(({ text, accelerator }) => ({ text, accelerator }))(window.__fake.menuItems["file.save"])'),
    { text: 'Save', accelerator: 'CmdOrCtrl+S' });

  check('launched via "Open With…": the file replaces the welcome doc',
    await js('[mdEditor.document.name, mdEditor.document.fileRef, editor.value]'),
    ['notes.md', '/Users/me/notes.md', '# Notes\n\nhello']);
  check('native window title set', await js('window.__fake.log.includes("title: notes.md")'), true);

  await js('document.querySelector("#editor").focus()');
  await js('{ const t = document.querySelector("#editor"); t.setSelectionRange(t.value.length, t.value.length); }');
  await type(' world');
  check('editing marks the native title "— Edited"', await js('window.__fake.log.at(-1)'), 'title: notes.md — Edited');

  await menu('file.save');
  await sleep(50);
  check('File ▸ Save writes back IN PLACE (no panel)', await js('window.__fake.disk["/Users/me/notes.md"]'), '# Notes\n\nhello world');
  check('…and the title is clean again', await js('window.__fake.log.at(-1)'), 'title: notes.md');

  await select(2, 7);
  await press('b', 'KeyB', 4); // ⌘B reaches the page, but the native menu owns it
  check('page ignores ⌘B (the menu owns it → no double toggle)', await js('editor.value.split("\\n")[0]'), '# Notes');
  await menu('format.bold');
  check('Format ▸ Bold runs exactly once', await js('editor.value.split("\\n")[0]'), '# **Notes**');

  await js('window.__fake.handlers.drag({ payload: { type: "enter", paths: [] } })');
  check('dragging a file shows the overlay', await js('document.querySelector("#drop-overlay").hidden'), false);
  js('window.__fake.handlers.drag({ payload: { type: "drop", paths: ["/Users/me/other.md"] } })');
  await sleep(300);
  check('dropping hides the overlay', await js('document.querySelector("#drop-overlay").hidden'), true);
  check('dropping over unsaved changes asks first', await js('document.querySelector("#sheet").open'), true);
  await clickSheet('discard');
  await sleep(300);
  check('dropped file opened with its real path', await js('[mdEditor.document.name, mdEditor.document.fileRef]'),
    ['other.md', '/Users/me/other.md']);

  await type('!');
  js('window.__fake.closePrevented = false; window.__fake.handlers.close({ preventDefault: () => { window.__fake.closePrevented = true; } })');
  await sleep(300);
  check('closing the window is intercepted…', await js('window.__fake.closePrevented'), true);
  check('…and shows our save sheet', await js('document.querySelector("#sheet").open'), true);
  await clickSheet('cancel');
  await sleep(300);
  check('Cancel keeps the window open', await js('window.__fake.log.includes("destroy")'), false);

  await js('window.__fake.pending.push("/Users/me/notes.md")');
  js('window.__fake.handlers["open-files-pending"]()');
  await sleep(300);
  check('"Open With…" while running asks about unsaved changes', await js('document.querySelector("#sheet").open'), true);
  await clickSheet('discard');
  await sleep(300);
  check('…then opens the file', await js('mdEditor.document.name'), 'notes.md');

  await menu('app.quit');
  await sleep(100);
  check('Quit on a clean document closes without asking', await js('window.__fake.log.at(-1)'), 'destroy');

  check('Format ▸ Table submenu exists', await js('window.__fake.submenus.includes("Table")'), true);
  check('"Show Ruler" check mark reflects the preference',
    await js('window.__fake.menuItems["view.toggleRuler"].checked'), true);
  await js('mdEditor.preferences.set("showRuler", false)');
  await sleep(50);
  check('…and follows it when it changes', await js('window.__fake.menuItems["view.toggleRuler"].checked'), false);
  await js('mdEditor.preferences.set("showRuler", true)');

  check('no errors or warnings in the console', app.consoleProblems, []);
  await app.close();
  return report();
}
