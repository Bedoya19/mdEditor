/**
 * @file DesktopMenu.js
 * The native macOS menu bar, described as DATA.
 *
 * Nothing here is new behaviour: every item runs an existing command id
 * (the same ones the toolbar buttons use), its label comes from the
 * CommandRegistry, and its shortcut comes from js/app/keymap.js. So the menu,
 * the toolbar tooltips and the keyboard can never disagree.
 *
 * `buildMenuSpec` is a pure function (unit-tested in Node); `installDesktopMenu`
 * hands the result to Tauri through the tauriApi adapter.
 */

const APP_NAME = 'Markdown Editor';
const SEP = { separator: true };

/**
 * Menu layout. An entry is one of:
 *  - "command.id"                                 → label + shortcut looked up automatically
 *  - { command, arg?, label?, accelerator?, id? } → explicit item
 *  - { command, check: 'prefKey' }                → item with a check mark showing that preference
 *  - { title, items: [...] }                      → submenu
 *  - { predefined: 'Copy' | … }                   → a standard macOS item (Tauri/AppKit implements it)
 *  - SEP
 *
 * The Edit menu MUST keep the predefined Undo…Select All items: on macOS a
 * custom menu bar without them makes ⌘Z/⌘X/⌘C/⌘V stop working in text fields.
 */
export const MENU_LAYOUT = [
  {
    title: APP_NAME, // macOS always shows the first menu under the app's name
    items: [
      { predefined: { About: null } },
      SEP,
      { predefined: 'Services' },
      SEP,
      { predefined: 'Hide' },
      { predefined: 'HideOthers' },
      { predefined: 'ShowAll' },
      SEP,
      // Not the predefined "Quit": that one exits immediately, skipping the
      // "Save changes?" sheet. Our command asks first, then closes the window
      // (and the app quits with its last window).
      { id: 'app.quit', command: 'window.close', label: `Quit ${APP_NAME}`, accelerator: 'CmdOrCtrl+Q' },
    ],
  },
  {
    title: 'File',
    items: [
      'file.new',
      'file.open',
      SEP,
      { id: 'file.close', command: 'window.close', label: 'Close', accelerator: 'CmdOrCtrl+W' },
      'file.save',
      'file.saveAs',
    ],
  },
  {
    title: 'Edit',
    items: [
      { predefined: 'Undo' },
      { predefined: 'Redo' },
      SEP,
      { predefined: 'Cut' },
      { predefined: 'Copy' },
      { predefined: 'Paste' },
      { predefined: 'SelectAll' },
    ],
  },
  {
    title: 'Format',
    items: [
      'format.bold', 'format.italic', 'format.strikethrough', 'format.code', 'format.link',
      SEP,
      'format.body', 'format.heading1', 'format.heading2', 'format.heading3', 'format.heading4',
      SEP,
      'format.bulletList', 'format.orderedList', 'format.taskList',
      SEP,
      'format.codeBlock', 'insert.rule',
      SEP,
      {
        title: 'Table',
        items: [
          'table.insert',
          SEP,
          'table.rowAbove', 'table.rowBelow', 'table.colLeft', 'table.colRight',
          SEP,
          'table.deleteRow', 'table.deleteColumn',
          SEP,
          'table.alignLeft', 'table.alignCenter', 'table.alignRight',
          SEP,
          'table.format',
          { command: 'table.toggleAutoFormat', check: 'autoFormatTables' },
        ],
      },
    ],
  },
  {
    title: 'View',
    items: [
      { id: 'view.edit', command: 'view.setMode', arg: 'edit', label: 'Editor Only' },
      { id: 'view.split', command: 'view.setMode', arg: 'split', label: 'Side by Side' },
      { id: 'view.preview', command: 'view.setMode', arg: 'preview', label: 'Preview Only' },
      'view.cycle',
      SEP,
      { command: 'view.toggleRuler', check: 'showRuler' },
      SEP,
      { predefined: 'Fullscreen' },
    ],
  },
  {
    title: 'Window',
    items: [
      { predefined: 'Minimize' },
      { predefined: 'Maximize', label: 'Zoom' },
      SEP,
      { predefined: 'BringAllToFront' },
    ],
  },
];

/**
 * keymap combo → Tauri accelerator:  "mod+shift+s" → "CmdOrCtrl+Shift+S",
 * "alt+mod+1" → "Alt+CmdOrCtrl+1", "mod+\" → "CmdOrCtrl+Backslash".
 * @param {string} combo
 */
export function toAccelerator(combo) {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop();
  const modifiers = { mod: 'CmdOrCtrl', shift: 'Shift', alt: 'Alt', ctrl: 'Ctrl' };
  const keyName = key === '\\' ? 'Backslash' : key.toUpperCase();
  return [...parts.map((m) => modifiers[m]), keyName].join('+');
}

/**
 * Resolves the layout into concrete items.
 * @param {typeof MENU_LAYOUT} layout
 * @param {{labelOf: (id: string) => string, keymap: Record<string, string>,
 *          isChecked?: (prefKey: string) => boolean}} sources
 * @returns {{spec: {title: string, items: object[]}[], handled: Set<string>}}
 *   `handled` = command ids whose shortcut the menu now owns.
 */
export function buildMenuSpec(layout, { labelOf, keymap, isChecked = () => false }) {
  const comboOf = new Map(Object.entries(keymap).map(([combo, id]) => [id, combo]));
  const handled = new Set();

  const resolve = (entry) => {
    if (entry === SEP || entry.separator || entry.predefined) return entry;
    if (entry.items) return { title: entry.title, items: entry.items.map(resolve) }; // submenu
    const item = typeof entry === 'string' ? { command: entry } : { ...entry };
    item.id ??= item.command;
    item.label ??= labelOf(item.command);
    if (!item.accelerator && item.arg === undefined && comboOf.has(item.command)) {
      item.accelerator = toAccelerator(comboOf.get(item.command));
    }
    if (item.accelerator && comboOf.has(item.command)) handled.add(item.command);
    if (item.check) item.checked = Boolean(isChecked(item.check));
    return item;
  };

  const spec = layout.map(({ title, items }) => ({ title, items: items.map(resolve) }));
  return { spec, handled };
}

/**
 * Builds and installs the menu bar.
 * @param {import('./tauriApi.js').TauriApi} api
 * @param {import('../../core/CommandRegistry.js').CommandRegistry} commands
 * @param {Record<string, string>} keymap
 * @param {(prefKey: string) => boolean} [isChecked]  State of check-mark items.
 * @returns {Promise<{handled: Set<string>, refreshChecks: () => void}>}
 *   handled: command ids whose shortcuts the menu owns.
 *   refreshChecks: call after a preference changes so check marks follow it.
 */
export async function installDesktopMenu(api, commands, keymap, isChecked = () => false) {
  const labels = new Map(commands.list().map(({ id, label }) => [id, label]));
  const { spec, handled } = buildMenuSpec(MENU_LAYOUT, {
    labelOf: (id) => labels.get(id) ?? id,
    keymap,
    isChecked,
  });
  const { checkItems } = await api.setAppMenu(spec, (item) => commands.execute(item.command, item.arg).catch(() => {}));
  return {
    handled,
    refreshChecks: () => checkItems.forEach(({ prefKey, setChecked }) => setChecked(Boolean(isChecked(prefKey)))),
  };
}
