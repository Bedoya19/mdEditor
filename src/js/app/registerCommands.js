/**
 * @file registerCommands.js
 * Registers every user action in the CommandRegistry.
 *
 * This file is the "menu bar" of the app in code form: reading it tells you
 * everything the app can do. Each command is a one-liner delegating to the
 * object that owns the behaviour.
 */

import { FORMAT_COMMANDS, TABLE_COMMANDS } from '../editor/formatCommands.js';
import { VIEW_MODES, stepZoom, clampZoom } from '../ui/Workspace.js';

/**
 * @param {import('../core/CommandRegistry.js').CommandRegistry} commands
 * @param {Object} deps
 * @param {import('./DocumentController.js').DocumentController} deps.documentController
 * @param {import('../ui/EditorView.js').EditorView} deps.editor
 * @param {import('../model/Preferences.js').Preferences} deps.preferences
 * @param {import('../platform/WindowService.js').WindowService} deps.windowService
 * @param {(message: string, kind?: 'info'|'error') => void} deps.notify  Status-bar messages.
 */
export function registerCommands(commands, { documentController, editor, preferences, windowService, notify }) {
  /* ── File ── */
  commands
    .register('file.new', () => documentController.newDocument(), 'New')
    .register('file.open', () => documentController.open(), 'Open…')
    .register('file.save', () => documentController.save(), 'Save')
    .register('file.saveAs', () => documentController.saveAs(), 'Save As…');

  /* ── Format: generated from the declarative table ── */
  for (const { id, label, transform } of FORMAT_COMMANDS) {
    commands.register(id, (arg) => editor.applyEdit(transform(editor.getState(), arg)), label);
  }

  /* ── Tables: same idea, plus the auto-format preference and a hint when
        the command doesn't apply where the cursor is ── */
  for (const { id, label, transform, unavailable } of TABLE_COMMANDS) {
    commands.register(id, (arg) => {
      const edit = transform(editor.getState(), arg, { pad: preferences.get('autoFormatTables') });
      if (edit) editor.applyEdit(edit);
      else if (unavailable) notify(unavailable);
    }, label);
  }
  commands.register('table.toggleAutoFormat',
    () => preferences.set('autoFormatTables', !preferences.get('autoFormatTables')),
    'Format Tables Automatically');

  // Keyboard-friendly aliases for the paragraph-style popup.
  const paragraphStyle = (prefix) => () => commands.execute('format.paragraphStyle', prefix);
  commands
    .register('format.body', paragraphStyle(''), 'Body')
    .register('format.heading1', paragraphStyle('# '), 'Heading 1')
    .register('format.heading2', paragraphStyle('## '), 'Heading 2')
    .register('format.heading3', paragraphStyle('### '), 'Heading 3')
    .register('format.heading4', paragraphStyle('#### '), 'Heading 4');

  /* ── View: they only change preferences; listeners update the UI ── */
  commands
    .register('view.setMode', (mode) => preferences.set('viewMode', mode), 'View Mode')
    .register('view.cycle', () => {
      const next = (VIEW_MODES.indexOf(preferences.get('viewMode')) + 1) % VIEW_MODES.length;
      preferences.set('viewMode', VIEW_MODES[next]);
    }, 'Cycle View Mode')
    .register('view.setFont', (key) => preferences.set('editorFont', key), 'Editor Font')
    .register('view.setFontSize', (px) => preferences.set('fontSize', Number(px)), 'Font Size')
    .register('view.toggleRuler', () => preferences.set('showRuler', !preferences.get('showRuler')), 'Show Ruler')
    .register('view.zoomIn', () => preferences.set('zoom', stepZoom(preferences.get('zoom'), +1)), 'Zoom In')
    .register('view.zoomOut', () => preferences.set('zoom', stepZoom(preferences.get('zoom'), -1)), 'Zoom Out')
    .register('view.zoomReset', () => preferences.set('zoom', 1), 'Actual Size')
    .register('view.setZoom', (zoom) => preferences.set('zoom', clampZoom(Number(zoom))), 'Set Zoom');

  /* ── Window (traffic lights) ── */
  commands
    .register('window.close', () => documentController.close(), 'Close')
    .register('window.minimize', () => windowService.minimize(), 'Minimize')
    .register('window.zoom', () => windowService.toggleMaximize(), 'Zoom');
}
