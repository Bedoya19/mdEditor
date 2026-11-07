/**
 * @file Toolbar.js
 * Connects any element carrying `data-command` to the CommandRegistry.
 *
 * DECLARATIVE WIRING
 *   <button data-command="format.bold">           → click runs "format.bold"
 *   <button data-command="view.setMode" data-arg="split"> → passes "split"
 *   <select data-command="view.setFontSize">      → change passes select.value
 *
 * The toolbar therefore contains ZERO knowledge about what buttons do. New
 * buttons need only HTML. It's used for the traffic lights too, since they
 * follow the same convention.
 */
export class Toolbar {
  /**
   * @param {HTMLElement} root  Container to scan (can be the whole window).
   * @param {import('../core/CommandRegistry.js').CommandRegistry} commands
   * @param {(commandId: string) => string|null} shortcutLabel  For tooltips.
   */
  constructor(root, commands, shortcutLabel = () => null) {
    this.root = root;
    this.commands = commands;
    this.#decorateTooltips(shortcutLabel);
    this.#bind();
  }

  /**
   * Reflects state back into the controls.
   *  - <select data-command=id>         → its value is set.
   *  - <button data-command=id data-arg> → pressed when arg === value.
   *  - <button data-command=id> (no arg) → pressed when value is truthy (toggle).
   * @param {string} commandId
   * @param {any} value
   */
  setValue(commandId, value) {
    this.root.querySelectorAll(`[data-command="${commandId}"]`).forEach((el) => {
      if (el instanceof HTMLSelectElement) {
        el.value = String(value);
      } else if ('arg' in el.dataset) {
        el.setAttribute('aria-pressed', String(el.dataset.arg === String(value)));
      } else {
        el.setAttribute('aria-pressed', String(Boolean(value)));
      }
    });
  }

  #bind() {
    this.root.addEventListener('click', (event) => {
      const el = event.target.closest('button[data-command]');
      if (!el || el.disabled || !this.root.contains(el)) return;
      this.commands.execute(el.dataset.command, el.dataset.arg).catch(() => {});
    });
    this.root.addEventListener('change', (event) => {
      const el = event.target.closest('select[data-command]');
      if (!el) return;
      this.commands.execute(el.dataset.command, el.value).catch(() => {});
    });
    // Toolbar buttons shouldn't steal focus from the editor on mouse click
    // (otherwise the text selection disappears before we format it).
    this.root.addEventListener('mousedown', (event) => {
      if (event.target.closest('button[data-command]')) event.preventDefault();
    });
  }

  /** Appends "(⌘B)" to tooltips, read from the single keymap. */
  #decorateTooltips(shortcutLabel) {
    this.root.querySelectorAll('[data-command]').forEach((el) => {
      const label = shortcutLabel(el.dataset.command);
      const base = el.getAttribute('title') ?? el.getAttribute('aria-label') ?? '';
      if (label && base) el.title = `${base} (${label})`;
    });
  }
}
