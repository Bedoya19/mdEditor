/**
 * @file Platform.js
 * The SHAPE every platform factory returns (documentation only, no code).
 *
 *   createBrowserPlatform()  → js/platform/browser/createBrowserPlatform.js
 *   createDesktopPlatform()  → js/platform/desktop/createDesktopPlatform.js
 *
 * index.js picks one and the rest of the app only ever sees this shape.
 * Optional members (marked "?") exist only where the platform supports them;
 * index.js calls them with `?.()` so their absence is harmless.
 *
 * @typedef {Object} DropHandlers
 * @property {(isHovering: boolean) => void} onHover  Show/hide the drop overlay.
 * @property {(payload: any) => void} onDrop          Opaque payload for FileService.openIncoming().
 *
 * @typedef {Object} Platform
 * @property {'browser'|'desktop'} kind
 * @property {import('./FileService.js').FileService} files
 * @property {import('./WindowService.js').WindowService} window
 * @property {{getItem(key: string): string|null, setItem(key: string, value: string): void} | null} storage
 *
 * @property {(target: HTMLElement, handlers: DropHandlers) => void} watchDrops
 *   Report files dragged over / dropped on the window.
 *
 * @property {(onOpen: (payload: any) => void) => void} [watchOpenRequests]
 *   Desktop only: files the OS asks us to open (Finder "Open With…").
 *
 * @property {(options: {commands: import('../core/CommandRegistry.js').CommandRegistry,
 *             keymap: Record<string, string>}) => Promise<Set<string>>} [installMenu]
 *   Desktop only: build the native menu bar. Resolves with the command ids the
 *   menu now handles (with their shortcuts), so the page doesn't handle them twice.
 */
export {};
