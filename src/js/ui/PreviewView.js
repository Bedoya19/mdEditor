/**
 * @file PreviewView.js
 * Shows rendered Markdown.
 *
 * The HTML it receives comes from MarkdownParser, which escapes all raw
 * HTML and neutralises dangerous URLs — so using innerHTML here is safe.
 * That guarantee lives in ONE place (the parser), which is easier to trust
 * than sanitising in every view.
 */
export class PreviewView {
  /**
   * @param {HTMLElement} article   Where the HTML goes.
   * @param {HTMLElement} scroller  The element that scrolls (the paper).
   */
  constructor(article, scroller) {
    this.article = article;
    this.scroller = scroller;
    this.#handleInPageLinks();
  }

  get scrollElement() {
    return this.scroller;
  }

  /** @param {string} html */
  render(html) {
    this.article.innerHTML = html;
    this.article.classList.toggle('is-empty', html.trim() === '');
  }

  /**
   * "#heading" links should scroll the preview, not change the page URL
   * (which in the desktop app would do nothing useful).
   */
  #handleInPageLinks() {
    this.article.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      event.preventDefault();
      const id = decodeURIComponent(link.getAttribute('href').slice(1));
      this.article.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth' });
    });
  }
}
