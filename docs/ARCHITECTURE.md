# Architecture

This document explains how the code is organised and why. Read it together
with `src/index.js`, which is short and wires everything described here.
All paths below are relative to `src/`.

## 1. Goals that drove the design

1. **Easy to understand.** Each file has one job and a header comment. No
   framework conventions to learn first.
2. **Browser and desktop from one codebase.** Anything that depends on the
   platform (files, window, menus) sits behind an abstraction. The desktop
   version (Tauri) was added as one new folder; see DESKTOP.md.
3. **SOLID where it helps.** We apply it where it makes the code simpler,
   not as ceremony.
4. **No runtime dependencies and no build step.** You edit a file, refresh
   the page and see the change. Tauri packages the `src/` folder as-is. The
   only npm package is the Tauri CLI, used at build time.

## 2. Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│ index.js  — composition root (creates objects, injects deps, wires)  │
└──────────────────────────────────────────────────────────────────────┘
        │ creates                    │ creates                  │ creates
┌───────▼────────┐   ┌───────────────▼─────────────┐   ┌────────▼──────────┐
│  ui/  (views)  │   │ app/  (use cases)           │   │ platform/         │
│ EditorView     │   │ DocumentController          │──▶│ FileService  «abs»│
│ PreviewView    │   │ registerCommands, keymap    │   │ WindowService«abs»│
│ Toolbar, …     │   └───────────────┬─────────────┘   │  ├ browser/ impls │
│                │                   │                 │  └ desktop/ impls │
└───────┬────────┘                   │                 └───────────────────┘
        │ uses                       │ uses
┌───────▼────────────────────────────▼─────────────────────────────────┐
│ model/  MarkdownDocument, Preferences   (state + events, no DOM)     │
│ editor/ text+tableTransforms, commands  (pure functions, no DOM)     │
│ markdown/ MarkdownParser + rules, tableSyntax (pure, no DOM)         │
│ core/   Observable, CommandRegistry, KeyboardShortcuts               │
└──────────────────────────────────────────────────────────────────────┘
```

**The dependency rule:** arrows point downward only. `model/`, `editor/`,
`markdown/` and `core/` know nothing about the DOM or the platform. That's
why `npm test` can run them in plain Node.

| Folder      | Responsibility                                    | Touches DOM? |
| ----------- | ------------------------------------------------- | ------------ |
| `core/`     | Generic mechanisms: events, commands, shortcuts   | only `KeyboardShortcuts.attach` |
| `model/`    | What the app *knows*: document text, dirty flag, preferences | no |
| `markdown/` | Markdown → HTML                                   | no           |
| `editor/`   | How to *change* Markdown text (bold, lists, tables…) | `smartKeys` only (listens to keys) |
| `platform/` | Files, window, drops, menu: browser vs desktop    | yes (implementations) |
| `ui/`       | Showing things and capturing input                | yes          |
| `app/`      | Use cases that coordinate the above               | no           |

## 3. Data flow

Data moves in one direction. Any behaviour can be traced by following the arrows.

```
TYPING      textarea ─input─▶ EditorView ─▶ document.setContent()
                                               │ emits "content"
                                               ├──▶ parser.parse() ─▶ PreviewView   (once per frame)
                                               └──▶ countStats()   ─▶ StatusBar
                                               │ emits "state" (dirty changed)
                                               └──▶ TitleBar ─▶ WindowService.setTitle()

CLICK/KEY   Toolbar button / KeyboardShortcuts ─▶ CommandRegistry.execute("format.bold")
                 ─▶ transform(editor.getState()) ─▶ editor.applyEdit()  (fires "input" → TYPING flow)

FILES       command "file.open" ─▶ DocumentController.open()
                 ─▶ (dirty? SheetDialog asks) ─▶ FileService.open() ─▶ document.load()
                                                                       │ emits "load"
                                                                       └──▶ EditorView.setText()

SETTINGS    command "view.setMode" ─▶ Preferences.set() ─emits "change"─▶ Workspace + Toolbar

FROM OUTSIDE  drop / Finder "Open With…" ─▶ platform.watchDrops / watchOpenRequests
                 ─▶ DocumentController.openIncoming(payload) ─▶ FileService.openIncoming(payload)
              (the payload is opaque: a DataTransfer in the browser, file paths on the desktop)

CLOSING     red light / ⌘W / ⌘Q ─▶ WindowService.guardClose ─▶ DocumentController.close()
                 ─▶ (dirty? SheetDialog asks) ─▶ WindowService.close()
```

## 4. SOLID, concretely

| Principle | Where you can see it |
| --------- | -------------------- |
| **S**ingle responsibility | Each view does one thing. `TitleBar` only shows the name, `StatusBar` only shows counts and messages. The parser is split three ways: `MarkdownParser` walks the blocks, `InlineRenderer` runs inline rules, and the rule files *describe* the syntax. `DocumentController` handles the file workflow but leaves the file I/O itself to `FileService`. |
| **O**pen/closed | You can add things without editing existing code: a Markdown syntax is a new object in `blockRules.js` or `inlineRules.js`, a toolbar action is a line in `formatCommands.js` plus a button in HTML, a shortcut is a line in `keymap.js`, and a platform is a new `FileService` subclass. |
| **L**iskov substitution | `FileSystemAccessService`, `DownloadFileService` and `DesktopFileService` keep the same promises: they resolve `null` on cancel, throw only on real errors, and return the same shapes. `DocumentController` can't tell which one it has, which is why the desktop version needed no change to it beyond a method rename. |
| **I**nterface segregation | Block rules get a 3-method API (`parseLines`, `inline`, `startsNewBlock`), not the whole parser. `DocumentController` gets two plain functions, `ask()` and `notify()`, instead of the `SheetDialog` and `StatusBar` objects. |
| **D**ependency inversion | High-level code depends on abstractions: `DocumentController` → `FileService`/`WindowService`, `Preferences` → an injected storage object, `MarkdownParser` → injected rules and renderer, the desktop services → an injected `tauriApi` adapter (so they're tested with a fake). Only `index.js` picks the concrete classes. |

## 5. Patterns used

- **Composition root** (`index.js`): the one place where concrete classes are chosen.
- **Observer** (`core/Observable.js`): models emit events, views subscribe.
- **Command** (`core/CommandRegistry.js`): every action has an id. Toolbar
  buttons, keyboard shortcuts and the desktop's native menu all go through `execute(id)`.
- **Strategy** (Markdown rules): the parser loops over interchangeable rule objects.
- **Abstract base class as interface** (`platform/*.js`): JS has no
  `interface` keyword, so a base class whose methods throw "not implemented" plays that role.
- **Factory** (`createBrowserPlatform`, `createDesktopPlatform`): each returns
  the same `Platform` shape (documented in `platform/Platform.js`).
- **Adapter** (`platform/desktop/tauriApi.js`): the only file that touches
  `window.__TAURI__`, so a Tauri upgrade changes one file.
- **Functional core, imperative shell:** text transforms and the parser are pure;
  the views are a thin layer that applies their results to the DOM.

## 6. Key decisions (and the alternatives we rejected)

| Decision | Why | Alternative considered |
| -------- | --- | ---------------------- |
| **No framework** (React, Vue…) | The UI is one window with a handful of widgets, and plain classes are easy to read. A framework would add a build step and its own concepts. | React: overkill for this size. |
| **Native ES modules, no bundler** | Nothing to build. File boundaries in the browser match the files on disk. | Vite/webpack: faster loading, but more tooling to learn. Not needed for a local app. |
| **Our own Markdown parser** | Zero dependencies, about 600 heavily commented lines, and safe by construction (raw HTML is always escaped). | `marked` / `markdown-it`: more complete, but a dependency plus a separate sanitizer. Easy to swap in, since anything with `parse(md) → html` fits. |
| **`<textarea>` editor** | Markdown is plain text. We get undo, spell-check, IME, accessibility and clipboard support from the browser. | `contenteditable` (very hard to get right), CodeMirror (a large dependency). |
| **`document.execCommand('insertText')`** | It's the only cross-browser way to change textarea text that keeps native **undo** working. It's deprecated but still supported everywhere, and there's a fallback in `EditorView.applyEdit`. | Setting `.value`: this erases the undo history. |
| **Native `<select>` and `<dialog>`, restyled** | Keyboard handling, focus trapping, screen readers and native menus come for free. | Custom dropdowns: a lot of code to make them accessible. |
| **Tauri for the desktop app** | ~4 MB instead of ~150 MB, uses macOS's own WebKit, and its plugins are called from JS. Full record in DESKTOP.md. | Electron (size), Neutralinojs (maturity). |
| **Tables edited through a model** (`tableTransforms.js`: find → model → change → serialize → place caret) | Every operation (Tab, add column, align…) is a few lines on a plain array, and caret placement lives in ONE tested function. | Editing the text directly per operation: lots of fragile string slicing. |
| **Table syntax shared** (`markdown/tableSyntax.js`) | The parser and the table tools must agree on what a cell is. | Two copies of the splitting logic that could drift apart. |
| **Text width in CSS variables** (`--text-width`, `--sheet-pad`, `--zoom`) | The ruler's markers, the page width and the text column are all derived from the same variables, so they can't misalign, and JS never measures layout. | Measuring elements in JS and positioning markers by hand. |
| **Notebook rules on the paper, shifted by `--scroll-y`** | Works the same in Chrome and Safari's WebKit. `background-attachment: local` on a textarea doesn't in WebKit. | `background-attachment: local`. |
| **Zoom = scaled sizes, not CSS `zoom`/`transform`** | Text stays crisp, the caret and selection stay exact, and the line height stays whole-pixel so the rules align. | `transform: scale()`: blurry text, wrong hit-testing. |
| **Proportional scroll sync** | Simple and independent of the parser. | Line mapping: precise, but couples the preview to the parser. |
| **Preview via `innerHTML`** | Safe only because the parser escapes everything. That guarantee lives in one tested place (`tests/markdownParser.test.js`, "security"). | Sanitizing in the view: duplicates the responsibility. |

## 7. How to extend

(GUIDE.md §9 walks through a complete, tested example step by step.)

**Add Markdown syntax, for example `==highlight==`.** Add one rule to
`js/markdown/inlineRules.js` before `bold`:

```js
{ name: 'highlight', pattern: /==(?=\S)([\s\S]*?\S)==/g,
  render: ([, text], { render }) => `<mark>${render(text)}</mark>` },
```

**Add a toolbar action, for example "Insert image".**
1. In `js/editor/formatCommands.js`:
   `{ id: 'insert.image', label: 'Image', transform: (s) => insertBlock(s, '![alt](path.png)') }`
2. In `index.html`: `<button class="tool" data-command="insert.image" title="Image">…</button>`
3. Optional, in `js/app/keymap.js`: `'mod+shift+i': 'insert.image'`
4. Desktop menu: add `'insert.image'` to the Format list in
   `js/platform/desktop/DesktopMenu.js`. A unit test fails if a keymap
   shortcut has no menu item, so you can't forget this when you add a shortcut.

No other file needs to change.

**Add a platform** (e.g. Windows). Subclass `FileService` and `WindowService`,
write a `createXPlatform()` factory returning the `Platform` shape, and choose
it in `index.js`. `platform/desktop/` is the worked example.

## 8. Known limitations (by design, for now)

- The parser doesn't implement raw HTML, reference-style links (`[x][ref]`)
  or footnotes. Raw HTML is shown as text on purpose, for safety.
- Relative image paths (`![](img/a.png)`) don't resolve against the open
  file yet, in either version. This is a planned next step (DESKTOP.md §7).
- One document at a time (a single window).
