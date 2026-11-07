/**
 * @file SheetDialog.js
 * macOS-style "sheet": a dialog that slides down from the window's toolbar
 * (instead of floating in the middle of the screen) — e.g. "Do you want to
 * save the changes…?".
 *
 * Built on the native <dialog> element: it gives us a focus trap, Esc
 * handling and correct accessibility semantics for free.
 *
 * Usage:
 *   const choice = await sheet.ask({
 *     title: 'Save changes?', message: '…',
 *     buttons: [{ id: 'save', label: 'Save', role: 'default' }, …],
 *   });
 */
export class SheetDialog {
  /**
   * @param {HTMLDialogElement} dialog
   * @param {HTMLElement} anchor  The sheet drops from this element's bottom edge (the toolbar).
   */
  constructor(dialog, anchor) {
    this.dialog = dialog;
    this.anchor = anchor;
    this.titleEl = dialog.querySelector('[data-role="sheet-title"]');
    this.messageEl = dialog.querySelector('[data-role="sheet-message"]');
    this.buttonsEl = dialog.querySelector('[data-role="sheet-buttons"]');
  }

  /**
   * @typedef {Object} SheetButton
   * @property {string} id
   * @property {string} label
   * @property {'default'|'cancel'|'secondary'} [role]
   *   default = blue, triggered by Enter. cancel = returned on Esc.
   *   secondary = placed on the far left (macOS puts "Don't Save" there).
   *
   * @param {{title: string, message?: string, buttons: SheetButton[]}} options
   * @returns {Promise<string>} The id of the clicked button.
   */
  ask({ title, message = '', buttons }) {
    this.titleEl.textContent = title;
    this.messageEl.textContent = message;

    const cancelId = buttons.find((b) => b.role === 'cancel')?.id ?? buttons.at(-1).id;
    const elements = buttons.map((button) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `aqua-button${button.role ? ` aqua-button--${button.role}` : ''}`;
      el.textContent = button.label;
      el.value = button.id;
      return el;
    });
    this.buttonsEl.replaceChildren(...elements);

    return new Promise((resolve) => {
      // One AbortController removes every listener of THIS question at once,
      // so nothing leaks into the next time the sheet is shown.
      const listeners = new AbortController();
      const finish = (id) => {
        listeners.abort();
        this.dialog.classList.remove('is-open');
        // Wait for the slide-up animation before really closing.
        setTimeout(() => this.dialog.close(), 180);
        resolve(id);
      };
      const { signal } = listeners;
      elements.forEach((el) => el.addEventListener('click', () => finish(el.value), { signal }));
      this.dialog.addEventListener('cancel', (event) => {
        event.preventDefault(); // we animate the close ourselves
        finish(cancelId);
      }, { signal });

      // <dialog> lives in the browser's "top layer", outside the window's
      // layout, so we position it under the toolbar ourselves.
      this.dialog.style.top = `${this.anchor.getBoundingClientRect().bottom}px`;
      this.dialog.showModal();
      requestAnimationFrame(() => this.dialog.classList.add('is-open'));
      (elements.find((_, i) => buttons[i].role === 'default') ?? elements[0]).focus();
    });
  }
}
