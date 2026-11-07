/**
 * @file PopoverMenu.js
 * Small helper for a menu built on the native HTML popover API
 * (`<div popover>` + `<button popovertarget>`).
 *
 * The browser already handles opening, closing on Esc and closing on a click
 * outside ("light dismiss"). Two things are left for us:
 *  1. POSITION: a popover opens in the centre of the screen by default; we
 *     place it under the button that opened it, kept inside the window.
 *  2. CLOSE AFTER A CHOICE: clicking an item runs its command (the Toolbar
 *     handles `data-command` clicks) and the menu should then close.
 */
export class PopoverMenu {
  /**
   * @param {HTMLElement} popover  The element with the `popover` attribute.
   */
  constructor(popover) {
    this.popover = popover;
    this.invoker = document.querySelector(`[popovertarget="${popover.id}"]`);

    popover.addEventListener('toggle', (event) => {
      if (event.newState === 'open') this.#position();
      this.invoker?.setAttribute('aria-expanded', String(event.newState === 'open'));
    });

    popover.addEventListener('click', (event) => {
      const item = event.target.closest('button[data-command]');
      if (item && !item.disabled) popover.hidePopover();
    });
  }

  #position() {
    if (!this.invoker) return;
    const anchor = this.invoker.getBoundingClientRect();
    const { width, height } = this.popover.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(margin, anchor.left), window.innerWidth - width - margin);
    const top = Math.min(anchor.bottom + 6, window.innerHeight - height - margin);
    Object.assign(this.popover.style, { left: `${left}px`, top: `${Math.max(margin, top)}px` });
  }
}
