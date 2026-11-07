/**
 * @file InlineRenderer.js
 * Applies a list of inline rules to one chunk of text (a paragraph, a
 * heading, a table cell…) and returns HTML.
 *
 * SINGLE RESPONSIBILITY: this class only knows *how to run* rules safely.
 * *Which* syntax exists lives in inlineRules.js.
 */

import { escapeHtml } from './htmlUtils.js';
import { defaultInlineRules } from './inlineRules.js';

/*
 * Placeholder token used by `protect()`. \u0000 (NUL) never appears in normal
 * text — and we strip it from input anyway — so it can't collide with content.
 */
const TOKEN = '\u0000';
const TOKEN_PATTERN = /\u0000(\d+)\u0000/g;

export class InlineRenderer {
  /** @param {import('./inlineRules.js').InlineRule[]} [rules] */
  constructor(rules = defaultInlineRules) {
    this.rules = rules;
  }

  /**
   * Renders raw (unescaped) text. Escaping happens first, so the output can
   * only contain tags produced by our own rules.
   * @param {string} text
   * @returns {string}
   */
  render(text) {
    const escaped = escapeHtml(String(text).replaceAll(TOKEN, ''));
    const stash = [];
    return this.#restore(this.#applyRules(escaped, stash), stash);
  }

  /**
   * Runs every rule over `text`. Nested renders (text inside a link, inside
   * **bold**…) reuse the SAME stash, so tokens created at any depth resolve
   * correctly when we restore once at the very end.
   */
  #applyRules(text, stash) {
    const ctx = {
      protect: (html) => `${TOKEN}${stash.push(html) - 1}${TOKEN}`,
      render: (inner) => this.#applyRules(inner, stash),
    };
    return this.rules.reduce(
      (output, rule) => output.replace(rule.pattern, (...match) => rule.render(match, ctx)),
      text,
    );
  }

  /** Swaps tokens back for their HTML. Loops because fragments can nest. */
  #restore(html, stash) {
    let previous;
    do {
      previous = html;
      html = html.replace(TOKEN_PATTERN, (token, index) => stash[Number(index)] ?? token);
    } while (html !== previous);
    return html;
  }
}
