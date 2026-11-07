/**
 * @file KeyboardShortcuts.js
 * Maps key combinations ("mod+s") to command ids ("file.save").
 *
 * "mod" means ⌘ on macOS and Ctrl elsewhere, so one table works on every OS.
 *
 * SINGLE RESPONSIBILITY: translate keystrokes into command ids. It doesn't
 * know what the commands do — it just asks the CommandRegistry to run them.
 *
 * NOTE (browser limitation): some combos like ⌘N / ⌘W are reserved by the
 * browser and never reach the page. They will work in the desktop version.
 */

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export class KeyboardShortcuts {
  /** @type {Map<string, string>} normalised combo → command id */
  #bindings = new Map();

  /** Command ids whose keys are handled elsewhere (the desktop's native menu). */
  #skip;

  /**
   * @param {import('./CommandRegistry.js').CommandRegistry} commands
   * @param {Record<string, string>} bindings e.g. { 'mod+s': 'file.save' }
   * @param {{skip?: Set<string>}} [options]
   *   skip: commands to leave to someone else. In the desktop app the native
   *   menu owns most shortcuts; if the page ALSO handled them, an action like
   *   Bold would run twice (and toggle itself straight back off). Skipped
   *   commands still get tooltip labels from labelFor().
   */
  constructor(commands, bindings, { skip = new Set() } = {}) {
    this.commands = commands;
    this.#skip = skip;
    Object.entries(bindings).forEach(([combo, id]) => this.#bindings.set(normalise(combo), id));
  }

  /** Starts listening on the given target (default: window). */
  attach(target = window) {
    target.addEventListener('keydown', (event) => {
      if (event.isComposing) return; // typing with an IME (e.g. Japanese)
      if (document.querySelector('dialog[open]')) return; // a sheet is asking something
      const id = this.#bindings.get(comboFromEvent(event));
      if (!id || this.#skip.has(id)) return; // not ours (or the native menu's job)
      event.preventDefault();
      this.commands.execute(id).catch(() => {});
    });
    return this;
  }

  /**
   * Shortcut label for a command id, or null if it has none.
   * @param {string} commandId
   */
  labelFor(commandId) {
    for (const [combo, id] of this.#bindings) {
      if (id === commandId) return KeyboardShortcuts.label(combo);
    }
    return null;
  }

  /** Human label for tooltips:"mod+shift+s" → "⇧⌘S" on Mac, "Ctrl+Shift+S" elsewhere. */
  static label(combo) {
    const parts = normalise(combo).split('+');
    const key = parts.pop().toUpperCase();
    if (IS_MAC) {
      const symbols = { ctrl: '⌃', alt: '⌥', shift: '⇧', mod: '⌘' };
      return ['ctrl', 'alt', 'shift', 'mod'].filter((m) => parts.includes(m)).map((m) => symbols[m]).join('') + key;
    }
    const names = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', mod: 'Ctrl' };
    return [...parts.map((m) => names[m]), key].join('+');
  }
}

/** Canonical order so "shift+mod+s" and "mod+shift+s" are the same key. */
function normalise(combo) {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop();
  const order = ['ctrl', 'alt', 'shift', 'mod'];
  return [...order.filter((m) => parts.includes(m)), key].join('+');
}

function comboFromEvent(event) {
  const mod = IS_MAC ? event.metaKey : event.ctrlKey;
  const parts = [];
  if (IS_MAC && event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (mod) parts.push('mod');
  // event.code is layout-independent ("KeyB", "Digit1"), and unaffected by
  // ⌥/⇧ turning "1" into "¡" or "!". Fall back to event.key for other keys.
  const code = /^(?:Key([A-Z])|Digit(\d))$/.exec(event.code ?? '');
  const key = code ? (code[1] ?? code[2]).toLowerCase() : event.key.toLowerCase();
  parts.push(key);
  return parts.join('+');
}
