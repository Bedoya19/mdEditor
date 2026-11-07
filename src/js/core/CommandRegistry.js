/**
 * @file CommandRegistry.js
 * Central catalogue of everything the user can DO ("file.save",
 * "format.bold"…). Command pattern.
 *
 * WHY?
 * Toolbar buttons, keyboard shortcuts and (later) native desktop menus all
 * trigger the same actions. Each of them only knows a command *id*; none of
 * them knows how the action is implemented.
 *   - Want a new action? `register()` it — no UI code changes (Open/Closed).
 *   - Want the desktop menu bar? It just calls `execute(id)`.
 */
export class CommandRegistry {
  /** @type {Map<string, {run: Function, label: string}>} */
  #commands = new Map();

  /**
   * @param {string} id      Namespaced id, e.g. "format.bold".
   * @param {(arg?: any) => any} run  The action (may be async).
   * @param {string} [label] Human-readable name (for menus / tooltips).
   * @returns {this} for chaining.
   */
  register(id, run, label = id) {
    if (this.#commands.has(id)) throw new Error(`Command "${id}" is already registered`);
    this.#commands.set(id, { run, label });
    return this;
  }

  /**
   * Runs a command. Errors are caught and logged so one failing action can't
   * break the whole UI; the promise still rejects for callers that care.
   * @param {string} id
   * @param {any} [arg]
   */
  async execute(id, arg) {
    const command = this.#commands.get(id);
    if (!command) {
      console.warn(`Unknown command "${id}"`);
      return undefined;
    }
    try {
      return await command.run(arg);
    } catch (error) {
      console.error(`Command "${id}" failed:`, error);
      throw error;
    }
  }

  /** @param {string} id */
  has(id) {
    return this.#commands.has(id);
  }

  /** @returns {{id: string, label: string}[]} */
  list() {
    return [...this.#commands].map(([id, { label }]) => ({ id, label }));
  }
}
