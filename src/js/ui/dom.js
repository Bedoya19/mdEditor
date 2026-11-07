/**
 * @file dom.js
 * Tiny DOM helpers used by the views.
 */

/**
 * querySelector that FAILS LOUDLY. If index.html and the JS drift apart
 * (renamed id, deleted element) you get a clear error at startup instead of
 * a mysterious "cannot read property of null" later.
 * @param {string} selector
 * @param {ParentNode} [root]
 * @returns {HTMLElement}
 */
export function $(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing element "${selector}" in index.html`);
  return element;
}

/**
 * Replaces a <select>'s options from data, so option lists have a single
 * source of truth in JS instead of being duplicated in HTML.
 * @param {HTMLSelectElement} select
 * @param {{value: string|number, label: string}[]} options
 */
export function fillSelect(select, options) {
  select.replaceChildren(
    ...options.map(({ value, label }) => new Option(label, String(value))),
  );
}
