/**
 * @file EditorView.js
 * Thin wrapper around the <textarea> where Markdown is written.
 *
 * WHY A PLAIN TEXTAREA (not contenteditable or a library like CodeMirror)?
 *  - Markdown IS plain text; a textarea edits plain text perfectly.
 *  - Native undo/redo, spell-check, IME, accessibility and copy/paste for free.
 *  - Zero dependencies, very little code.
 *
 * The view exposes the selection as a plain `TextState` and accepts
 * `TextEdit`s computed by the pure functions in editor/textTransforms.js.
 */
/**
 * Characters macOS's "smart" substitutions produce (System Settings ›
 * Keyboard › "Use smart quotes and dashes"). In a SOURCE editor they corrupt
 * the text: `--` in a table delimiter becomes `—`, and `"` inside code
 * becomes `“`.
 */
const SMART_SUBSTITUTES = /[—–“”‘’…]/; // — – “ ” ‘ ’ …

export class EditorView {
  /** @param {HTMLTextAreaElement} textarea */
  constructor(textarea) {
    this.textarea = textarea;
    this.#blockSmartSubstitutions();
  }

  /**
   * Stops the OS from swapping what you typed for typographic characters.
   * Two layers:
   *  1. `autocorrect="off"` on the <textarea> (index.html) asks WebKit not to substitute.
   *  2. If a substitution still arrives, it comes as an "insertReplacementText"
   *     input (the OS *replacing* text, not you typing). We cancel those when
   *     they would introduce a smart character. Typing a real em dash yourself
   *     (⌥⇧-) is a normal "insertText" input, so it still works.
   */
  #blockSmartSubstitutions() {
    this.textarea.addEventListener('beforeinput', (event) => {
      const replacement = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
      if (event.inputType === 'insertReplacementText' && SMART_SUBSTITUTES.test(replacement)) {
        event.preventDefault();
      }
    });
  }

  /** Element that scrolls (used by ScrollSync). */
  get scrollElement() {
    return this.textarea;
  }

  /** @returns {import('../editor/textTransforms.js').TextState} */
  getState() {
    const { value, selectionStart, selectionEnd } = this.textarea;
    return { text: value, start: selectionStart, end: selectionEnd };
  }

  /**
   * Applies a TextEdit while KEEPING NATIVE UNDO.
   *
   * Setting `textarea.value` directly wipes the undo stack, so ⌘Z would stop
   * working after any toolbar action. `document.execCommand('insertText')` is
   * formally deprecated but is still the only API every browser supports that
   * inserts text *as if typed* (undoable, fires "input"). If it ever
   * disappears, we fall back to `setRangeText` (works, but not undoable).
   * @param {import('../editor/textTransforms.js').TextEdit} edit
   */
  applyEdit({ from, to, insert, selectStart, selectEnd }) {
    const ta = this.textarea;
    ta.focus();
    ta.setSelectionRange(from, to);

    let applied = false;
    if (from !== to || insert !== '') {
      applied = insert === ''
        ? document.execCommand('delete', false)
        : document.execCommand('insertText', false, insert);
    }
    if (!applied && (from !== to || insert !== '')) {
      ta.setRangeText(insert, from, to, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ta.setSelectionRange(selectStart, selectEnd);
    ta.dispatchEvent(new Event('select'));
  }

  /** Replaces the whole text (open/new). Caret goes to the top. */
  setText(text) {
    this.textarea.value = text;
    this.textarea.setSelectionRange(0, 0);
    this.textarea.scrollTop = 0;
  }

  focus() {
    this.textarea.focus();
  }

  /** @param {(scrollTop: number) => void} callback  Fired when the text scrolls. */
  onScroll(callback) {
    this.textarea.addEventListener('scroll', () => callback(this.textarea.scrollTop), { passive: true });
  }

  /** @param {(text: string) => void} callback  Fired on every user edit. */
  onInput(callback) {
    this.textarea.addEventListener('input', () => callback(this.textarea.value));
  }

  /** @param {(state: import('../editor/textTransforms.js').TextState) => void} callback */
  onCaretMove(callback) {
    const notify = () => callback(this.getState());
    ['keyup', 'mouseup', 'select', 'input', 'focus'].forEach((type) =>
      this.textarea.addEventListener(type, notify),
    );
  }
}
