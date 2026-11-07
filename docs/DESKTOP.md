# Desktop version (Tauri 2, macOS)

The desktop app is the same web app (`src/`), shown in a native macOS window
by [Tauri](https://tauri.app). It saves files in place, opens `.md` files from
Finder, has a real menu bar and real traffic lights, and the whole app is
about **4 MB**.

## 1. Decision record: why Tauri

**Context.** The app exists because nothing else opens a `.md` file without a
compromise: IDEs are heavy, browsers don't render Markdown, and word processors
convert (and damage) the file. It also has to stay small and maintainable by
one person who knows HTML, CSS and JS.

| | Electron | **Tauri 2 (chosen)** | Neutralinojs |
|---|---|---|---|
| App size | ~150 MB (bundles Chromium) | **~4 MB** (uses macOS's WebKit) | ~2 MB |
| Memory | High | Low | Low |
| Code we maintain | JS | **JS** (+ ~25 lines of Rust glue, written once) | JS |
| Toolchain to build | Node | Node + Rust (installed, never written) | Node |
| Maturity: menus, file associations, security | Very high | High | Limited |
| Native feel | Chromium look | **Safari engine, real traffic lights, system spell-check** | Safari engine |

**Decision.** Use Tauri. Its official plugins are called **from JavaScript**,
so the code we maintain stays HTML/CSS/JS. Rust is limited to the generated
scaffold and one short file (`src-tauri/src/lib.rs`).

**Costs we accept.**
- The Rust toolchain must be installed to *build* the app (you never write Rust).
- The first build takes a few minutes; later builds take seconds.
- The engine is Safari's WebKit, not Chrome's. Everything the app uses works
  in Safari 16.4+.
- Without an Apple Developer ID ($99/year), macOS warns "unidentified
  developer" the first time you open the app. Right-click the app, choose
  **Open**, and confirm once.

**Scope.** macOS only, one document per window. Windows/Linux or
TextEdit-style multiple windows can be added later without a redesign.

## 2. Setup (once)

1. Install the Xcode Command Line Tools: `xcode-select --install`
2. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
3. Make sure Rust is on your `PATH`. Add this line to `~/.zshrc`, then open a
   new terminal:
   ```bash
   . "$HOME/.cargo/env"
   ```
4. In the project folder: `npm install` (installs the Tauri CLI, the only dev dependency)

## 3. Everyday commands

| Command | What it does |
|---|---|
| `npm run desktop` | Runs the app in development mode. Edit a file in `src/`, then press ⌘R in the app to reload. Right-click → **Inspect Element** opens Safari's Web Inspector. |
| `npm run desktop:build` | Builds `src-tauri/target/release/bundle/macos/Markdown Editor.app` and a `.dmg` |
| `npm run icon` | Regenerates every icon size from `assets/app-icon.png` (rendered from `assets/app-icon.svg`) |

To install: open the `.dmg` and drag the app to **Applications**. To make it
the default for Markdown files: in Finder, select a `.md` file, press ⌘I,
choose it under **Open with**, and click **Change All…**.

## 4. How it fits the architecture

Everything platform-specific was already behind `FileService` and
`WindowService` (see ARCHITECTURE.md). The desktop version adds
**one folder** of JavaScript and leaves the parser, editor, views and
controller untouched:

```
src/js/platform/desktop/
  tauriApi.js              the ONLY file that touches window.__TAURI__ (adapter)
  DesktopFileService.js    native Open/Save panels, read/write by absolute path
  DesktopWindowService.js  title, close (destroy), minimise, zoom, close guard
  DesktopMenu.js           the menu bar as data: labels from commands, shortcuts from keymap.js
  createDesktopPlatform.js same shape as createBrowserPlatform() (see platform/Platform.js)
```

`src/index.js` picks the platform in one place:

```js
const platform = window.__TAURI__
  ? (await import('./js/platform/desktop/createDesktopPlatform.js')).createDesktopPlatform()
  : createBrowserPlatform();
```

Two small contract changes made both platforms fit:
- **`FileService.openIncoming(payload)`** replaces `openDropped(dataTransfer)`.
  The payload is opaque: a `DataTransfer` in the browser, an array of paths on
  the desktop (from a drop or from Finder). Real paths are what make
  "drop a file, then ⌘S" save in place.
- **`WindowService.guardClose({ hasUnsavedWork, requestClose })`**. A browser
  can only show its generic "Leave site?" prompt. The desktop cancels the
  close and lets the app show our own "Save changes?" sheet.

### Details worth knowing

- **Menu shortcuts vs page shortcuts.** The native menu owns every shortcut
  in `keymap.js`, and `KeyboardShortcuts` skips those commands on the desktop.
  Otherwise Bold would run twice and toggle itself straight back off. A unit
  test enforces that every keymap entry has a menu item.
- **The Edit menu** keeps macOS's standard Undo/Cut/Copy/Paste/Select All
  items. Without them, ⌘C/⌘V stop working in text fields.
- **Quit (⌘Q) and Close (⌘W)** run our `window.close` command, which asks
  about unsaved changes first. macOS's built-in Quit would exit immediately.
- **Traffic lights** are the real macOS ones (`titleBarStyle: "Overlay"`,
  positioned by `trafficLightPosition` in `tauri.conf.json`). The CSS ones are
  hidden on the desktop. The window is forced to `"theme": "Light"`, so the
  lights grey out properly when it's inactive even if your Mac is in dark mode.
  They're the standard size macOS uses for windows without a native toolbar.
- **Check marks in the menu** ("Show Ruler", "Format Tables Automatically")
  are real `CheckMenuItem`s that follow the preferences (`refreshChecks`).
- **Minimum macOS 14**, because the table menu uses the HTML popover API (Safari 17).
- **Dragging the window** works from any empty part of the title bar or toolbar
  (`data-tauri-drag-region="deep"` on `.chrome` in `index.html`).

## 5. The native side (you shouldn't need to touch it)

| File | Purpose |
|---|---|
| `src-tauri/src/lib.rs` | Enables the dialog and fs plugins, and forwards Finder "Open With…" files to the page. About 55 lines, half of them comments. |
| `src-tauri/tauri.conf.json` | App name and id, window (size, overlay title bar, traffic-light position), security policy (CSP), bundle (icon, `.md` file association) |
| `src-tauri/capabilities/default.json` | **What the page is allowed to ask for.** Tauri refuses everything not listed. File access is limited to Markdown/text files under your home folder and external drives. |
| `src-tauri/Cargo.toml` | Rust dependencies, plus size optimisations for release builds |

**Upgrading Tauri** (rarely): `npm install -D @tauri-apps/cli@latest`, then
`cd src-tauri && cargo update`. If Tauri's JavaScript API ever changes, the
only JS file to adapt is `tauriApi.js`.

## 6. Testing

- `npm test`: unit tests, including the desktop services and menu with a
  fake Tauri API (`tests/desktopPlatform.test.js`) and the save/discard
  workflow (`tests/documentController.test.js`).
- `npm run test:e2e`: drives the real page in headless Chrome twice. First as
  the browser version, then with a **fake `window.__TAURI__`** injected, which
  exercises the whole desktop code path (menu, shortcuts, Open With, drops,
  close guard) without Tauri.
- **Manual checklist** (what only the real app can show):
  - [ ] ⌘O opens the native panel; the file loads
  - [ ] Edit, then ⌘S: the same file on disk changes (check it in another app)
  - [ ] ⇧⌘S: Save As panel; typing a name without an extension still produces a `.md` file
  - [ ] Drag a `.md` from Finder onto the window, edit, ⌘S: saved in place
  - [ ] Red traffic light / ⌘W / ⌘Q with unsaved changes shows the sheet; Cancel keeps the window
  - [ ] Menu items and shortcuts work, each only once (⌘B toggles bold once)
  - [ ] ⌘C / ⌘V / ⌘Z work in the editor
  - [ ] Traffic lights are vertically centred in the title bar, and grey (not white) when the window is inactive
  - [ ] Typing `--` in a table's delimiter row stays `--` (no em dash)
  - [ ] Notebook rules stay under the text when scrolling and at several zoom levels
  - [ ] Table menu: the size grid inserts a table; Tab/⇧Tab/Enter move between cells
  - [ ] Dragging a ruler marker changes the text width on both pages
  - [ ] ⌘+ / ⌘− / ⌘0 and pinch zoom; Format ▸ Table submenu; check marks follow the toolbar
  - [ ] Built app: Finder → Open With → Markdown Editor works when the app is closed and when it's already open

## 7. Possible next steps

- Relative images (`![](img/pic.png)`) resolved against the open file's folder
  (Tauri's asset protocol plus a URL resolver in `PreviewView`; the parser stays unchanged).
- Remember the window size and position (`tauri-plugin-window-state`).
- Several documents at once (TextEdit-style windows).
- Windows/Linux builds.
