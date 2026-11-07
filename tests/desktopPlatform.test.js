/**
 * Unit tests for the desktop platform, run in Node with a FAKE Tauri API.
 * This is possible because the services never touch `window.__TAURI__`
 * directly — they receive the small tauriApi adapter as a parameter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DesktopFileService } from '../src/js/platform/desktop/DesktopFileService.js';
import { DesktopWindowService } from '../src/js/platform/desktop/DesktopWindowService.js';
import { MENU_LAYOUT, buildMenuSpec, toAccelerator } from '../src/js/platform/desktop/DesktopMenu.js';
import { KEYMAP } from '../src/js/app/keymap.js';

/** In-memory "disk" + scripted dialog answers. */
function fakeApi({ openAnswer = null, saveAnswer = null, files = {} } = {}) {
  const disk = { ...files };
  const calls = [];
  return {
    disk,
    calls,
    pickFileToOpen: async () => openAnswer,
    pickFileToSave: async (defaultPath) => { calls.push(['save-panel', defaultPath]); return saveAnswer; },
    readTextFile: async (path) => {
      if (!(path in disk)) throw new Error(`not found: ${path}`);
      return disk[path];
    },
    writeTextFile: async (path, text) => { disk[path] = text; },
    setTitle: (title) => calls.push(['title', title]),
    destroyWindow: () => calls.push(['destroy']),
    minimize: () => calls.push(['minimize']),
    toggleMaximize: () => calls.push(['zoom']),
    onCloseRequested: (handler) => { calls.push(['guard', handler]); },
  };
}

/* ── DesktopFileService ── */

test('open: cancel resolves null (FileService contract)', async () => {
  assert.equal(await new DesktopFileService(fakeApi()).open(), null);
});

test('open: reads the picked file; fileRef is its path', async () => {
  const api = fakeApi({ openAnswer: '/Users/me/notes.md', files: { '/Users/me/notes.md': '# Hi' } });
  assert.deepEqual(await new DesktopFileService(api).open(), {
    name: 'notes.md', content: '# Hi', fileRef: '/Users/me/notes.md',
  });
});

test('save: writes back IN PLACE when the document has a path', async () => {
  const api = fakeApi({ files: { '/a/b.md': 'old' } });
  const saved = await new DesktopFileService(api).save({ name: 'b.md', content: 'new', fileRef: '/a/b.md' });
  assert.equal(api.disk['/a/b.md'], 'new');
  assert.deepEqual(saved, { name: 'b.md', fileRef: '/a/b.md' });
  assert.equal(api.calls.length, 0, 'no save panel shown');
});

test('save: an untitled document goes through Save As', async () => {
  const api = fakeApi({ saveAnswer: '/a/new.md' });
  const saved = await new DesktopFileService(api).save({ name: 'Untitled.md', content: 'x', fileRef: null });
  assert.deepEqual(api.calls[0], ['save-panel', 'Untitled.md']);
  assert.deepEqual(saved, { name: 'new.md', fileRef: '/a/new.md' });
});

test('saveAs: cancel → null; missing extension → ".md" added', async () => {
  assert.equal(await new DesktopFileService(fakeApi()).saveAs({ name: 'x.md', content: '' }), null);
  const api = fakeApi({ saveAnswer: '/a/notes' });
  const saved = await new DesktopFileService(api).saveAs({ name: 'x.md', content: 'hi' });
  assert.equal(api.disk['/a/notes.md'], 'hi');
  assert.equal(saved.name, 'notes.md');
});

test('openIncoming: first Markdown file wins; non-text files are refused', async () => {
  const api = fakeApi({ files: { '/d/readme.md': 'R' } });
  const service = new DesktopFileService(api);
  assert.equal((await service.openIncoming(['/d/photo.png', '/d/readme.md'])).name, 'readme.md');
  await assert.rejects(service.openIncoming(['/d/photo.png']), /only Markdown/);
  assert.equal(await service.openIncoming([]), null);
});

test('read errors propagate (they are real failures, not cancels)', async () => {
  const api = fakeApi({ openAnswer: '/gone.md' });
  await assert.rejects(new DesktopFileService(api).open(), /not found/);
});

/* ── DesktopWindowService ── */

test('window: title shows "— Edited"; close() destroys (no second prompt)', () => {
  const api = fakeApi();
  const win = new DesktopWindowService(api);
  win.setTitle('a.md', true);
  win.close();
  assert.deepEqual(api.calls, [['title', 'a.md — Edited'], ['destroy']]);
});

test('window: close requests are cancelled and handed to the app', () => {
  const api = fakeApi();
  let requested = 0;
  new DesktopWindowService(api).guardClose({ hasUnsavedWork: () => true, requestClose: () => requested++ });
  const handler = api.calls.find(([name]) => name === 'guard')[1];
  let prevented = false;
  handler({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(requested, 1);
});

/* ── DesktopMenu ── */

test('toAccelerator converts keymap combos', () => {
  assert.equal(toAccelerator('mod+shift+s'), 'CmdOrCtrl+Shift+S');
  assert.equal(toAccelerator('alt+mod+1'), 'Alt+CmdOrCtrl+1');
  assert.equal(toAccelerator('mod+\\'), 'CmdOrCtrl+Backslash');
});

test('menu: labels and shortcuts come from the registry and the keymap', () => {
  const { spec } = buildMenuSpec(MENU_LAYOUT, { labelOf: (id) => `L:${id}`, keymap: KEYMAP });
  const save = spec.find((m) => m.title === 'File').items.find((i) => i.command === 'file.save');
  assert.deepEqual(save, { command: 'file.save', id: 'file.save', label: 'L:file.save', accelerator: 'CmdOrCtrl+S' });
});

test('menu: EVERY keymap shortcut is owned by a menu item (so nothing runs twice or not at all)', () => {
  const { handled } = buildMenuSpec(MENU_LAYOUT, { labelOf: (id) => id, keymap: KEYMAP });
  assert.deepEqual([...handled].sort(), [...new Set(Object.values(KEYMAP))].sort());
});

test('menu: the Edit menu keeps the system items ⌘C/⌘V/⌘Z depend on', () => {
  const edit = MENU_LAYOUT.find((m) => m.title === 'Edit').items.map((i) => i.predefined);
  for (const name of ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'SelectAll']) assert.ok(edit.includes(name), name);
});

test('menu: item ids are unique (Tauri routes clicks by id)', () => {
  const { spec } = buildMenuSpec(MENU_LAYOUT, { labelOf: (id) => id, keymap: KEYMAP });
  const ids = spec.flatMap((m) => m.items).filter((i) => i.id).map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});
