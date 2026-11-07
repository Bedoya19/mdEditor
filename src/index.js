/**
 * @file index.js — COMPOSITION ROOT
 *
 * The only file that knows about every module. It creates the objects,
 * hands each one its dependencies, and connects events between them.
 * No business logic lives here — just wiring.
 *
 * WHY ONE WIRING FILE?
 *  - Every other module receives its collaborators instead of importing
 *    concrete ones, so they stay decoupled and testable (Dependency Inversion).
 *  - Swapping an implementation (desktop file access, another Markdown
 *    parser…) is a one-line change HERE.
 *
 * Data flow (one direction, easy to follow):
 *
 *   user types ─▶ EditorView ─▶ MarkdownDocument ─(events)─▶ Preview, StatusBar, TitleBar
 *   user clicks ─▶ Toolbar / KeyboardShortcuts ─▶ CommandRegistry ─▶ controller / editor / preferences
 *   Preferences ─(events)─▶ Workspace, Ruler, Toolbar state
 */

// Core
import { CommandRegistry } from './js/core/CommandRegistry.js';
import { KeyboardShortcuts } from './js/core/KeyboardShortcuts.js';
// Models
import { MarkdownDocument } from './js/model/MarkdownDocument.js';
import { Preferences, DEFAULT_PREFERENCES } from './js/model/Preferences.js';
import { countStats, cursorPosition } from './js/model/documentStats.js';
// Markdown
import { MarkdownParser } from './js/markdown/MarkdownParser.js';
// Editor behaviour
import { PARAGRAPH_STYLES } from './js/editor/formatCommands.js';
import { detectLinePrefix } from './js/editor/textTransforms.js';
import { isInTable } from './js/editor/tableTransforms.js';
import { attachSmartKeys } from './js/editor/smartKeys.js';
// Platform: browser here; the desktop one is loaded on demand (see step 1)
import { createBrowserPlatform } from './js/platform/browser/createBrowserPlatform.js';
// UI
import { $, fillSelect } from './js/ui/dom.js';
import { EDITOR_FONTS, FONT_SIZES } from './js/ui/fonts.js';
import { EditorView } from './js/ui/EditorView.js';
import { PreviewView } from './js/ui/PreviewView.js';
import { Workspace } from './js/ui/Workspace.js';
import { Toolbar } from './js/ui/Toolbar.js';
import { TitleBar } from './js/ui/TitleBar.js';
import { StatusBar } from './js/ui/StatusBar.js';
import { Ruler } from './js/ui/Ruler.js';
import { SheetDialog } from './js/ui/SheetDialog.js';
import { ScrollSync } from './js/ui/ScrollSync.js';
import { PopoverMenu } from './js/ui/PopoverMenu.js';
import { TableSizePicker } from './js/ui/TableSizePicker.js';
// Application
import { DocumentController } from './js/app/DocumentController.js';
import { registerCommands } from './js/app/registerCommands.js';
import { KEYMAP } from './js/app/keymap.js';
import { WELCOME_NAME, WELCOME_TEXT } from './js/app/welcomeDocument.js';

/* ───────────── 1. Platform & models ───────────── */

/*
 * Inside the Tauri desktop app `window.__TAURI__` exists (tauri.conf.json:
 * withGlobalTauri). The desktop code is imported dynamically, so a browser
 * never downloads it. This is the ONLY place the two worlds diverge.
 */
const platform = window.__TAURI__
  ? (await import('./js/platform/desktop/createDesktopPlatform.js')).createDesktopPlatform()
  : createBrowserPlatform();
document.documentElement.dataset.platform = platform.kind; // CSS hook, set early to avoid a flash

const parser = new MarkdownParser();
const document_ = new MarkdownDocument(); // trailing "_" avoids shadowing the global `document`
const preferences = new Preferences(platform.storage);
const commands = new CommandRegistry();

/* ───────────── 2. Views ───────────── */

const windowEl = $('#window');

// Option lists come from data (single source of truth), not hard-coded HTML.
fillSelect($('#paragraph-style'), PARAGRAPH_STYLES.map(({ prefix, label }) => ({ value: prefix, label })));
fillSelect($('#editor-font'), Object.entries(EDITOR_FONTS).map(([value, { label }]) => ({ value, label })));
fillSelect($('#font-size'), FONT_SIZES.map((size) => ({ value: size, label: String(size) })));

const editor = new EditorView($('#editor'));
const preview = new PreviewView($('#preview'), $('#preview-scroller'));
const workspace = new Workspace($('#workspace'));
// One ruler per sheet; both edit the same shared text width.
const rulers = [...document.querySelectorAll('[data-role="ruler"]')].map((el) => new Ruler(el, {
  getWidth: () => preferences.get('textWidth'),
  onWidthChange: (px) => preferences.set('textWidth', px),
  onReset: () => preferences.set('textWidth', DEFAULT_PREFERENCES.textWidth),
}));
const statusBar = new StatusBar($('#statusbar'));
new TableSizePicker($('[data-role="table-picker"]'));
new PopoverMenu($('#table-menu'));
const sheet = new SheetDialog($('#sheet'), $('.chrome', windowEl));
// Desktop: macOS itself zooms on title-bar double-click (Tauri drag region),
// so we only handle it in the browser — otherwise it would zoom twice.
const titleBar = new TitleBar(
  $('#titlebar'),
  platform.window,
  platform.kind === 'browser' ? () => commands.execute('window.zoom') : null,
);

/* ───────────── 3. Controllers & commands ───────────── */

const documentController = new DocumentController({
  document: document_,
  files: platform.files,
  windowService: platform.window,
  ask: (options) => sheet.ask(options),
  notify: (message, kind) => statusBar.flash(message, kind),
});

registerCommands(commands, {
  documentController,
  editor,
  preferences,
  windowService: platform.window,
  notify: (message, kind) => statusBar.flash(message, kind),
});

// Desktop: the native menu bar owns most shortcuts; the page skips those.
// Its check-mark items (Show Ruler…) read their state from the preferences.
const menu = await platform.installMenu?.({ commands, keymap: KEYMAP, isChecked: (key) => preferences.get(key) });
const shortcuts = new KeyboardShortcuts(commands, KEYMAP, { skip: menu?.handled ?? new Set() }).attach(window);
const toolbar = new Toolbar(windowEl, commands, (id) => shortcuts.labelFor(id));

// Shortcut labels shown inside menus (e.g. "⌥⌘T" next to "Format Table").
document.querySelectorAll('[data-shortcut-for]').forEach((el) => {
  el.textContent = shortcuts.labelFor(el.dataset.shortcutFor) ?? '';
});

attachSmartKeys(editor, { autoFormatTables: () => preferences.get('autoFormatTables') });
const dropOverlay = $('#drop-overlay');
platform.watchDrops(windowEl, {
  onHover: (isHovering) => { dropOverlay.hidden = !isHovering; },
  onDrop: (payload) => documentController.openIncoming(payload),
});
new ScrollSync(editor.scrollElement, preview.scrollElement);

// The notebook rules are drawn on the paper behind the textarea (see
// workspace.css); keep them moving with the text.
const notebook = $('#notebook');
editor.onScroll((top) => notebook.style.setProperty('--scroll-y', `${top}px`));

/* ───────────── 4. Events: document → views ───────────── */

editor.onInput((text) => document_.setContent(text));

document_.on('load', (text) => {
  editor.setText(text);
  statusBar.setCaret({ line: 1, column: 1 });
});

// Re-render at most once per animation frame, however fast the user types.
let renderFrame = 0;
document_.on('content', (text) => {
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(() => {
    preview.render(parser.parse(text));
    statusBar.setStats(countStats(text));
  });
});

document_.on('state', (state) => titleBar.update(state));

// Table commands only make sense with the caret inside a table.
const tableOnlyItems = [...document.querySelectorAll('[data-requires="table"]')];
editor.onCaretMove((state) => {
  statusBar.setCaret(cursorPosition(state.text, state.start));
  toolbar.setValue('format.paragraphStyle', detectLinePrefix(state));
  const inTable = isInTable(state);
  tableOnlyItems.forEach((item) => { item.disabled = !inTable; });
});

/* ───────────── 5. Events: preferences → views ───────────── */

const applyPreference = {
  viewMode: (mode) => { workspace.setViewMode(mode); toolbar.setValue('view.setMode', mode); },
  editorFont: (key) => { workspace.setEditorFont(key); toolbar.setValue('view.setFont', key); },
  fontSize: (px) => { workspace.setFontSize(px); toolbar.setValue('view.setFontSize', px); },
  showRuler: (show) => { rulers.forEach((r) => r.setVisible(show)); toolbar.setValue('view.toggleRuler', show); },
  textWidth: (px) => { workspace.setTextWidth(px); rulers.forEach((r) => r.refresh()); },
  autoFormatTables: (on) => toolbar.setValue('table.toggleAutoFormat', on),
};
preferences.on('change', ({ key, value }) => {
  applyPreference[key]?.(value);
  menu?.refreshChecks(); // keep the desktop menu's check marks in sync
});
Object.entries(applyPreference).forEach(([key, apply]) => apply(preferences.get(key)));

/* ───────────── 6. Start ───────────── */

statusBar.setHint(
  platform.files.capabilities.canSaveInPlace
    ? 'Saves directly to the file on disk'
    : 'This browser can’t write files: Save downloads a copy',
);
document_.load({ content: WELCOME_TEXT, name: WELCOME_NAME });
editor.focus();

// Desktop: files sent by Finder ("Open With…", double-click) — including the
// one that launched the app — replace the welcome document.
platform.watchOpenRequests?.((payload) => documentController.openIncoming(payload));

// Handy for debugging in the Web Inspector: mdEditor.commands.execute('file.save')
window.mdEditor = Object.freeze({ commands, document: document_, preferences });
