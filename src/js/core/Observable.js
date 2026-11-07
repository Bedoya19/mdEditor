/**
 * @file Observable.js
 * Minimal publish/subscribe base class (Observer pattern).
 *
 * WHY?
 * Models (the document, the preferences) must announce changes without
 * knowing who listens. The title bar, status bar and preview each subscribe
 * on their own. Adding a new listener never requires editing the model —
 * low coupling, Open/Closed.
 */
export class Observable {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map();

  /**
   * Subscribes to an event.
   * @param {string} event
   * @param {(payload: any) => void} listener
   * @returns {() => void} Call it to unsubscribe.
   */
  on(event, listener) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(listener);
    return () => this.#listeners.get(event)?.delete(listener);
  }

  /**
   * Notifies every listener of `event`.
   * @param {string} event
   * @param {any} [payload]
   */
  emit(event, payload) {
    this.#listeners.get(event)?.forEach((listener) => listener(payload));
  }
}
