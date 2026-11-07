/**
 * @file TitleBar.js
 * Shows "name.md — Edited" in the window's title bar, macOS-style, and
 * mirrors it to the OS/tab title through the WindowService.
 */
export class TitleBar {
  /**
   * @param {HTMLElement} root  The <header class="titlebar">.
   * @param {import('../platform/WindowService.js').WindowService} windowService
   * @param {(() => void) | null} onDoubleClick  macOS zooms the window on
   *   title-bar double-click. Pass null where the OS already does it (desktop).
   */
  constructor(root, windowService, onDoubleClick) {
    this.nameEl = root.querySelector('[data-role="doc-name"]');
    this.editedEl = root.querySelector('[data-role="doc-edited"]');
    this.windowEl = root.closest('.window');
    this.windowService = windowService;

    if (onDoubleClick) {
      root.addEventListener('dblclick', (event) => {
        if (!event.target.closest('button')) onDoubleClick();
      });
    }
  }

  /** @param {{name: string, isDirty: boolean}} state */
  update({ name, isDirty }) {
    this.nameEl.textContent = name;
    this.editedEl.hidden = !isDirty;
    // The red traffic light shows a dot when there are unsaved changes (macOS convention).
    this.windowEl.classList.toggle('is-dirty', isDirty);
    this.windowService.setTitle(name, isDirty);
  }
}
