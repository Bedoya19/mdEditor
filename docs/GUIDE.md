# Working on Markdown Editor

A practical guide for running, testing, building and **changing** this app.
Read it top to bottom once. After that, use it as a reference.

---

## 0. The 30-second version

Run every command from the project folder (the one with `package.json`).

| I want to…                         | Command                   | Takes   |
| ---------------------------------- | ------------------------- | ------- |
| Run the **web version**            | `npm start`               | instant |
| Run the **desktop app** (dev mode) | `npm run desktop`         | ~20 s first time, then ~3 s |
| Check I didn't break anything      | `npm test`                | ~1 s    |
| …and the full UI check             | `npm run test:e2e`        | ~20 s   |
| Build the real **.app / .dmg**     | `npm run desktop:build`   | ~1 min  |
| Save my work in git                | `git add -A && git commit -m "What I did"` | instant |

The loop you'll use 95 % of the time:

```
edit a file → reload the app (⌘R) → npm test → git commit
```

---

## 1. One-time setup

1. **Node.js 22+**: check with `node --version`.
2. **Rust** (only needed for the desktop app). It's already installed on this
   Mac, but your shell doesn't know where it is. Add this line to `~/.zshrc`,
   then open a **new** terminal:
   ```bash
   . "$HOME/.cargo/env"
   ```
   Check with `cargo --version`.
3. **Project tools**: `npm install` (installs the Tauri CLI; nothing else).

---

## 2. Running the app

### Web version: `npm start`
Opens http://127.0.0.1:8080 in your browser. After editing any file in
`src/`, press **⌘R** in the browser. Stop the server with **Ctrl+C** in the terminal.

Use Chrome for development: it saves files in place, and its DevTools are
the best (see §8).

### Desktop app: `npm run desktop`
Compiles the native shell (only the first time, or when `src-tauri/` changes)
and opens the app window. After editing a file in `src/`, press **⌘R inside
the app window**. Changes to `src-tauri/` rebuild and restart the app
automatically. Stop it with **Ctrl+C** in the terminal or **⌘Q** in the app.

> **Both versions run the same code** (`src/`). A change made for one is
> automatically in the other. Only `src/js/platform/browser/` and
> `src/js/platform/desktop/` differ.

---

## 3. Testing

### `npm test`: unit tests (run this ALL the time)
About 80 small tests of the logic: the Markdown parser, every formatting and
table operation, the file workflow, the desktop menu… They run in about a
second, without a browser. Files: `tests/*.test.js`.

When everything is fine, the end of the output says `ℹ fail 0`. When something
breaks, you'll see something like:

```
✖ toggleList applies, numbers and removes
  AssertionError: Expected values to be strictly equal:
  + actual - expected
  + '[1. a\n\n1. b]'
  - '[1. a\n\n2. b]'
```

That reads as: *the test named "toggleList…" expected `2. b` but got
`1. b`.* The test name tells you which feature, and `+`/`-` tell you exactly
what differs.

### `npm run test:e2e`: end-to-end checks (before committing a UI change)
Opens the real app in an invisible Chrome and uses it like a person: types,
clicks the toolbar, presses shortcuts, opens the table menu, drags the ruler,
zooms… It runs twice: as the **web version**, and as the **desktop version**
with a simulated Tauri. Each check prints `PASS` or `FAIL` with what it got
versus what it expected. Files: `scripts/e2e/`.

### What tests can't check
How things *look* and how the real desktop app behaves (native panels, real
files). After a visual or desktop change, open the app and look. The manual
checklist is in `DESKTOP.md` §6.

---

## 4. Building and installing the app

```bash
npm run desktop:build
```

Results in `src-tauri/target/release/bundle/`:
- `macos/Markdown Editor.app`: the app itself
- `dmg/Markdown Editor_<version>_aarch64.dmg`: the installer to share

**Install:** open the `.dmg` and drag the app to Applications. **First launch:**
right-click the app, choose **Open**, and confirm. macOS asks once because the
app isn't signed with a paid Apple Developer ID.

**New version:** change `"version"` in `src-tauri/tauri.conf.json` (and in
`package.json` to keep them matching), then build.

---

## 5. Git: your safety net

The project is a git repository. Every commit is a snapshot you can return to.

| Situation | Command |
|---|---|
| What did I change? | `git status` (which files), `git diff` (which lines) |
| Save a snapshot | `git add -A` then `git commit -m "Short description"` |
| History | `git log --oneline` |
| Undo my changes to one file (not committed yet) | `git restore src/css/tokens.css` |
| Undo ALL uncommitted changes | `git restore .` (careful: this discards them) |
| Try something risky | `git switch -c experiment` … then back with `git switch main` |
| Keep the experiment | `git switch main && git merge experiment` |
| Throw the experiment away | `git switch main && git branch -D experiment` |
| Undo a commit that's already made | `git revert <commit-id>` (creates an "undo" commit) |

Commit small and often, one idea per commit, so any step can be undone on its own.

The repository is set up with your personal identity (Bedoya19). To publish it
on GitHub later: create an empty repository there, then
`git remote add origin git@github-personal:Bedoya19/<repo-name>.git` and
`git push -u origin main`. The `github-personal` SSH alias already exists in
your `~/.ssh/config`.

---

## 6. Where do I change…?

Start from **what you want to change**, not from a file. Each kind of change
has exactly one home:

| I want to change… | File(s) |
|---|---|
| Colours, textures, shadows, fonts, sizes | `src/css/tokens.css` (all of them live here) |
| The look of one part of the UI | `src/css/<part>.css`, listed in `src/styles.css` |
| How the preview (rendered Markdown) looks | `src/css/markdown.css` |
| Toolbar buttons: layout, icons | `src/index.html` (icons are the `<symbol>`s at the top) |
| What a formatting button does | `src/js/editor/formatCommands.js` → `textTransforms.js` |
| Table behaviour | `src/js/editor/tableTransforms.js` |
| Enter / Tab behaviour while typing | `src/js/editor/smartKeys.js` |
| Markdown syntax (what renders as what) | `src/js/markdown/inlineRules.js` (bold, links…) or `blockRules.js` (lists, quotes…) |
| Keyboard shortcuts | `src/js/app/keymap.js` |
| The desktop menu bar | `src/js/platform/desktop/DesktopMenu.js` |
| Open / Save / "Save changes?" | `src/js/app/DocumentController.js` |
| Settings and their defaults | `src/js/model/Preferences.js` |
| The welcome document | `src/js/app/welcomeDocument.js` |
| Desktop window size, app name, file types | `src-tauri/tauri.conf.json` |
| What the desktop app may access | `src-tauri/capabilities/default.json` |

### The "follow the command" trick
Every button and menu item has a command id. To find the code behind any button:

1. In `src/index.html`, find the button. It has e.g. `data-command="format.bold"`.
2. Search for that id: `grep -rn "format.bold" src/`
3. You'll land in `formatCommands.js` (what it does) or `registerCommands.js`
   (where it's connected), and from there in the function that does the work.

Every file starts with a comment that explains what it's for, so read that first.

---

## 7. The mental model (how a change flows)

```
You type / click
   │
   ▼
ui/           Views: show things, capture input. Thin, no logic.
   │  "run command format.bold"
   ▼
app/ + core/  Commands, shortcuts, the file workflow: they decide WHAT happens.
   │
   ▼
editor/ markdown/ model/
              The logic, as pure functions with no DOM: text in → text out.
              This is where most bugs are fixed, and what the unit tests cover.
   │
   ▼
platform/     Talking to the outside world (files, window): browser or desktop.
```

Rule of thumb: **logic goes in the lower layers** (and gets a test), and
**views stay dumb**. If you're writing an `if` about Markdown inside `ui/`,
it probably belongs in `editor/`.

---

## 8. Debugging

- **Browser:** press ⌥⌘I for DevTools. The **Console** tab shows errors in red.
- **Desktop app (dev mode):** right-click anywhere → **Inspect Element**
  opens Safari's Web Inspector, with the same Console.
- **The `mdEditor` object** is available in either console:
  ```js
  mdEditor.commands.list()                 // every command id and label
  mdEditor.commands.execute('format.bold') // run any command
  mdEditor.document.content                // the current text
  mdEditor.preferences.get('zoom')         // any setting
  mdEditor.preferences.set('textWidth', 600)
  ```
- **Quick look inside a function:** add `console.log('here', value)`, reload,
  read it in the Console. Remove it before committing.
- **Status bar:** file errors ("Couldn't save: …") appear at the bottom of the window.

---

## 9. Worked examples

### A. Change the paper colour (2 minutes)
1. Open `src/css/tokens.css` and find `--paper: #fffefb;`.
2. Change it, e.g. to `#fffbea` (a warmer white).
3. ⌘R in the app and look.
4. `git add -A && git commit -m "Warmer paper colour"`.

Every colour works the same way. Component stylesheets only use these variables.

### B. Add a new formatting button: `==highlight==` (15 minutes)
This touches every layer once, so it's the best way to learn the codebase.

**1. Teach the parser the syntax**, in `src/js/markdown/inlineRules.js`. Add
this object to the list **just before** the `bold` rule:
```js
{
  name: 'highlight',
  pattern: /==(?=\S)([\s\S]*?\S)==/g,
  render: ([, text], { render }) => `<mark>${render(text)}</mark>`,
},
```

**2. Write a test**, in `tests/markdownParser.test.js`:
```js
test('highlight', () => {
  assert.equal(render('==hi=='), '<p><mark>hi</mark></p>');
});
```
Run `npm test`. It should pass. (Try breaking the rule to watch the test fail.)

**3. Style it**, at the end of `src/css/markdown.css`:
```css
.markdown mark {
  padding: 0 0.15em;
  background: #fff3a3;
  border-radius: 2px;
}
```

**4. Add the command**, in `src/js/editor/formatCommands.js`, inside
`FORMAT_COMMANDS`, after the `format.code` line:
```js
{ id: 'format.highlight', label: 'Highlight', transform: (s) => toggleWrap(s, '==', 'highlighted text') },
```

**5. Add the button**, in `src/index.html`, inside the group with B / I / S:
```html
<button type="button" class="tool tool--glyph" data-command="format.highlight" title="Highlight" aria-label="Highlight">H</button>
```

**6. Add it to the desktop menu**, in `src/js/platform/desktop/DesktopMenu.js`,
in the `Format` list after `'format.code'`: `'format.highlight',`

**7. (Optional) A shortcut**, in `src/js/app/keymap.js`:
`'mod+shift+h': 'format.highlight',`. Tooltips and the menu pick it up
automatically. If you add a shortcut but forget step 6, `npm test` fails and
tells you.

**8. Check and commit:** `npm test`, `npm run test:e2e`, try it in the app,
then `git commit`.

That's the whole recipe for any formatting feature. You never had to touch
the toolbar code, the menu code or the shortcut code: they're driven by these
lists (the Open/Closed principle in practice).

### C. Fix a bug (the professional way), your first real exercise
This is a **real, unfixed** bug, left on purpose for you to practise on.

> In a list inside a quote, `> - item`, pressing Enter gives `> ` instead of
> `> - `, so the list marker is lost.

1. **Reproduce it** in the app: type `> - item` and press Enter.
2. **Find the code.** It's Enter while typing, so `src/js/editor/smartKeys.js`,
   which calls `continueList()` in `src/js/editor/textTransforms.js`.
3. **Write a test that fails**, in `tests/textTransforms.test.js`, inside the
   `continueList continues…` test:
   ```js
   assert.equal(run(t.continueList, '> - item|'), '> - item\n> - |');
   ```
   Run `npm test`: it **fails**, which proves the test catches the bug. (In
   tests, `|` marks the caret.)
4. **Fix the function** until `npm test` passes. Hint: `continueList` reads
   the line's marker with the `CONTINUABLE` regex just above it. The quote
   `> ` is matched, but nothing then looks for a list marker *after* it. One
   approach: when the marker is `> `, apply the same logic to the rest of the
   line and put `> ` in front of the result.
5. **Check in the app**, run `npm run test:e2e`, and commit:
   `git commit -m "Continue lists inside quotes"`.

The test stays in the project forever, so this bug can never come back unnoticed.

---

## 10. Checklist before every commit

- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes (if you touched the UI)
- [ ] I looked at the change in the app
- [ ] No leftover `console.log`
- [ ] New file? It starts with a header comment explaining its job
- [ ] `git diff` shows only what I meant to change

---

## 11. Rules of thumb

- **Don't add npm packages lightly.** The app has zero runtime dependencies,
  and that's a feature.
- **Keep logic pure.** Functions in `editor/` and `markdown/` take text and
  return text. That's what makes them testable.
- **Leave `src-tauri/` alone** unless you're changing desktop-specific config.
  The app logic never lives there.
- **One source of truth.** Shortcuts live only in `keymap.js`, colours only in
  `tokens.css`, menu labels come from the commands. Don't copy them elsewhere.
- **When unsure where something goes**, find a similar existing feature and copy its shape.

## 12. Further reading

- `docs/ARCHITECTURE.md`: why the code is organised this way (layers, SOLID, decisions).
- `docs/DESIGN.md`: the visual design and the reasons behind it.
- `docs/DESKTOP.md`: the desktop app, Tauri, and the manual test checklist.
