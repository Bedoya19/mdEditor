# Markdown Editor

A local Markdown **reader and writer**, built with plain **HTML, CSS and JavaScript**
(no frameworks, no build step, no runtime dependencies). It looks like macOS
**TextEdit**, redone in the skeuomorphic *Aqua* style: brushed aluminium, glossy
buttons, real-looking paper.

**New here? Start with [docs/GUIDE.md](docs/GUIDE.md)**, the practical guide
to running, testing, building and changing the app.

The same code runs two ways:
- **In a browser**, for quick testing (`npm start`).
- **As a native macOS app** (about 4 MB) via [Tauri](https://tauri.app)
  (`npm run desktop`). See [docs/DESKTOP.md](docs/DESKTOP.md).

---

## Run it

### In the browser

```bash
npm start            # starts http://127.0.0.1:8080 and opens your browser
```

All you need is Node 22+. The browser version needs no `npm install`.
If you'd rather use Python: `cd src && python3 -m http.server 8080`, then open the URL.

> **Why not just double-click `index.html`?** Browsers don't load JavaScript
> modules from `file://` URLs, so the page would stay blank. Any local
> server fixes that.

### Browser support

| Browser                         | Open | Save                                        |
| ------------------------------- | ---- | ------------------------------------------- |
| Chrome, Edge, Brave, Arc, Opera | ✅   | ✅ writes straight back to the same file    |
| Safari, Firefox                 | ✅   | ⚠️ downloads a copy (the browser doesn't allow pages to write files) |

The desktop app always saves in place.

### As a macOS app

```bash
npm install              # once: installs the Tauri CLI (dev-only)
npm run desktop          # run in development
npm run desktop:build    # build "Markdown Editor.app" + .dmg
```

This needs the Xcode Command Line Tools and Rust installed. You never write
Rust; it's only used to build the app. Setup steps, the design decisions and
a manual test checklist are in [docs/DESKTOP.md](docs/DESKTOP.md).

## Features

- **Three views:** editor only, side by side, preview only (`⌘\` cycles through them).
- **Formatting toolbar:** paragraph style (Body, Heading 1–6, Quote), bold,
  italic, strikethrough, inline code, lists (bulleted, numbered, checklist), link,
  code block, table, horizontal rule.
- **Smart typing:** Enter continues a list or quote, Enter on an empty item ends
  it, Tab/⇧Tab indents and outdents. Press Esc, then Tab, to move focus out of the editor.
- **Files:** New, Open, Save, Save As, plus drag-and-drop a file onto the window.
  You're asked before unsaved changes are thrown away.
- **Desktop extras:** a native menu bar, the real traffic lights, and Finder
  "Open With…" / double-click for `.md` files.
- **Tables without the tedium:** insert from a size grid, Tab / ⇧Tab / Enter
  to move between cells, add or delete rows and columns, align columns, and
  automatic pipe alignment (can be turned off).
- **Text-width ruler:** drag the margin markers on top of the page to set how
  wide the text column is (line length), for both the editor and the preview.
- **Zoom:** ⌘+ / ⌘− / ⌘0 or pinch. It magnifies the pages, not the toolbar.
- **No silent rewriting:** macOS "smart dashes/quotes" and autocorrect are
  off in the editor, so `--` stays `--`.
- **Status bar:** word and character count, line and column, zoom, save messages.
- **Preferences** that persist: view mode, editor font and size, text width,
  zoom, ruler, table auto-format.
- **Safe preview:** raw HTML in a file is shown as text, never run, and
  `javascript:` links are disabled.

### Keyboard shortcuts

| Action              | Shortcut   | Action           | Shortcut |
| ------------------- | ---------- | ---------------- | -------- |
| Open                | ⌘O         | Bold / Italic    | ⌘B / ⌘I  |
| Save / Save As      | ⌘S / ⇧⌘S   | Strikethrough    | ⇧⌘X      |
| New *(desktop only)* | ⌘N        | Inline code      | ⌘E       |
| Close / Quit *(desktop)* | ⌘W / ⌘Q | | |
| Cycle view mode     | ⌘\         | Link             | ⌘K       |
| Body / Heading 1–4  | ⌥⌘0 … ⌥⌘4  | Bullets / Numbers / Checklist | ⇧⌘8 / ⇧⌘7 / ⇧⌘9 |
| Zoom in / out / 100 % | ⌘+ / ⌘− / ⌘0 | Format table | ⌥⌘T |
| In a table: next / previous cell | Tab / ⇧Tab | In a table: cell below | Enter |

On Windows and Linux, use Ctrl in place of ⌘. Every shortcut is defined in one
file, [`src/js/app/keymap.js`](src/js/app/keymap.js). The toolbar tooltips and the
desktop menu bar are both built from it.

## Tests

```bash
npm test             # unit tests (Node's built-in runner, no dependencies)
npm run test:e2e     # end-to-end, in headless Google Chrome
```

- **Unit tests** cover the Markdown parser (including the security rules),
  every text transform, the file workflow, and the desktop services. The
  desktop tests use a fake Tauri API, so everything runs in Node.
- **End-to-end tests** drive the real page twice: once as the browser version,
  and once with a fake `window.__TAURI__` injected, which exercises the whole
  desktop code path.

## Project layout

```
src/                  THE APP (exactly what the browser loads and Tauri packages)
  index.html          Structure only (markup + icon sprite)
  styles.css          CSS entry point → imports css/*
  index.js            Composition root: builds and wires every module
  css/                One stylesheet per UI component, plus design tokens
  js/
    core/             Generic building blocks (observer, commands, shortcuts)
    model/            App state: the document, preferences, statistics
    markdown/         Markdown → HTML engine (parser + pluggable rules)
    editor/           Pure text & table transforms, command tables, smart keys
    platform/         File/window abstractions
      browser/        …implemented with web APIs
      desktop/        …implemented with Tauri
    ui/               Thin views, one per piece of the interface
    app/              Use cases: document workflow, command registration, keymap
src-tauri/            Native macOS shell (config, permissions, ~25 lines of Rust + comments)
assets/               App icon source (SVG + 1024px PNG)
tests/                Unit tests (node --test)
scripts/              Dev server and end-to-end checks
docs/                 Architecture, design and desktop write-ups
```

## Documentation

- [docs/GUIDE.md](docs/GUIDE.md): **how to work on it.** Commands, git,
  "where do I change X?", debugging, and worked examples.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, data flow, how each
  SOLID principle shows up in the code, the main technical decisions, and how to extend the app.
- [docs/DESIGN.md](docs/DESIGN.md): the visual design and the reasons behind it.
- [docs/DESKTOP.md](docs/DESKTOP.md): why Tauri, setup, how the desktop version
  fits the architecture, and the manual test checklist.

Every source file also starts with a header comment that says what the file
is responsible for and why it exists.
