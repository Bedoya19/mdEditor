/**
 * @file browser.js — end-to-end checks of the BROWSER version.
 * Drives the real page like a user: typing, toolbar, shortcuts, the save sheet…
 * Unit tests cover the logic; this checks the pieces are wired together.
 */
import { openApp, createChecks, sleep } from './harness.js';

export async function runBrowserChecks() {
  const app = await openApp({ appPort: 8097, debugPort: 9337 });
  const { js, press, enter, type, value, select } = app;
  const { check, report } = createChecks('Browser version');

  check('welcome document renders', await js('document.querySelector("#preview h1")?.textContent'), 'Welcome to Markdown Editor');
  check('browser platform detected', await js('document.documentElement.dataset.platform'), 'browser');

  await js('mdEditor.commands.execute("file.new")');
  check('New gives a clean, empty document', await js('[editor.value, document.title]'), ['', 'Untitled.md — Markdown Editor']);

  await js('document.querySelector("#editor").focus()');
  await type('hello world');
  check('typing updates the model', await js('mdEditor.document.content'), 'hello world');
  check('title shows unsaved changes', await js('document.title'), '• Untitled.md — Markdown Editor');

  await select(6, 11);
  await js('mdEditor.commands.execute("format.bold")');
  check('Bold wraps the selection', await value(), 'hello **world**');
  await js('document.execCommand("undo")');
  check('native undo works after formatting', await value(), 'hello world');

  await select(0, 5);
  await press('b', 'KeyB', 4); // 4 = ⌘
  check('⌘B shortcut', await value(), '**hello** world');

  await js('{ const t = document.querySelector("#editor"); t.setSelectionRange(t.value.length, t.value.length); }');
  await enter();
  await type('- item');
  await enter();
  check('Enter continues a list', await value(), '**hello** world\n- item\n- ');
  await enter();
  check('Enter on an empty item ends the list', await value(), '**hello** world\n- item\n');
  await sleep(100);
  check('preview renders the Markdown', await js('document.querySelector("#preview").innerHTML'),
    '<p><strong>hello</strong> world</p>\n<ul>\n<li>item</li>\n</ul>');

  await js(`{ const s = document.querySelector("#paragraph-style"); s.value = "# ";
              s.dispatchEvent(new Event("change", { bubbles: true })); }`);
  check('paragraph popup turns the caret line into a heading', (await value()).split('\n')[2], '# ');

  js('mdEditor.commands.execute("file.new")'); // not awaited: the sheet waits for an answer
  await sleep(400);
  check('the save sheet appears for unsaved changes', await js('document.querySelector("#sheet").open'), true);
  await js('[...document.querySelectorAll("#sheet button")].find((b) => b.value === "cancel").click()');
  await sleep(300);
  check('Cancel keeps the text', (await value()).startsWith('**hello**'), true);

  await js('mdEditor.commands.execute("view.setMode", "preview")');
  await sleep(100);
  check('preview mode hides the source', await js('getComputedStyle(document.querySelector(".pane--source")).display'), 'none');
  check('view switch reflects the mode', await js('document.querySelector("[data-arg=preview]").getAttribute("aria-pressed")'), 'true');
  await js('mdEditor.commands.execute("view.setMode", "split")');

  await js('mdEditor.commands.execute("view.toggleRuler")');
  check('rulers can be hidden', await js('[...document.querySelectorAll(".ruler")].every((r) => r.hidden)'), true);
  await js('mdEditor.commands.execute("view.toggleRuler")');

  // Tables: open the popover from the toolbar, pick 2 columns × 3 rows.
  js('mdEditor.commands.execute("file.new")'); // not awaited: it waits for the sheet's answer
  await sleep(300);
  await js('[...document.querySelectorAll("#sheet button")].find((b) => b.value === "discard").click()');
  await sleep(300);
  await js('document.querySelector("#editor").focus()');
  check('table operations are disabled outside a table',
    await js('document.querySelector("[data-command=\\"table.rowBelow\\"]").disabled'), true);
  await js('document.querySelector("[popovertarget=table-menu]").click()');
  await sleep(100);
  check('the table button opens the popover', await js('document.querySelector("#table-menu").matches(":popover-open")'), true);
  await js('document.querySelector(".table-picker__cell[data-arg=\\"2x3\\"]").click()');
  await sleep(100);
  check('picking a size inserts the table and closes the popover', [
    await value(),
    await js('document.querySelector("#table-menu").matches(":popover-open")'),
  ], ['| Column 1 | Column 2 |\n| -------- | -------- |\n|          |          |\n|          |          |\n\n', false]);
  check('…with "Column 1" selected, ready to type over',
    await js('{ const t = document.querySelector("#editor"); t.value.slice(t.selectionStart, t.selectionEnd); }'), 'Column 1');

  await type('Fruit');
  await press('Tab', 'Tab', 0);
  await type('Qty'); // replaces the selected "Column 2" placeholder
  await press('Tab', 'Tab', 0);
  await type('Banana');
  await press('Tab', 'Tab', 0);
  await type('3');
  // Alignment happens on Tab/Enter/commands, not while typing: re-align now.
  await press('t', 'KeyT', 1 | 4); // ⌥⌘T = Format Table (1 = Alt, 4 = ⌘)
  check('Tab moves between cells (selecting them); ⌥⌘T re-aligns the pipes', (await value()).split('\n').slice(0, 3),
    ['| Fruit  | Qty |', '| ------ | --- |', '| Banana | 3   |']);
  check('table operations are enabled inside a table',
    await js('document.querySelector("[data-command=\\"table.rowBelow\\"]").disabled'), false);
  await js('mdEditor.commands.execute("table.alignRight")');
  check('Align Right acts on the caret\'s column', (await value()).split('\n').slice(1, 3),
    ['| ------ | --: |', '| Banana |   3 |']);

  // macOS "smart dashes" arrive as an OS replacement, not as typing.
  const replacementBlocked = (data, inputType) => js(`(() => {
    const e = new InputEvent('beforeinput', { inputType: '${inputType}', data: '${data}', cancelable: true, bubbles: true });
    document.querySelector('#editor').dispatchEvent(e);
    return e.defaultPrevented;
  })()`);
  check('OS smart-dash replacement is blocked', await replacementBlocked('—', 'insertReplacementText'), true);
  check('OS smart-quote replacement is blocked', await replacementBlocked('“', 'insertReplacementText'), true);
  check('typing a real em dash still works', await replacementBlocked('—', 'insertText'), false);
  check('ordinary spelling corrections are untouched', await replacementBlocked('the', 'insertReplacementText'), false);

  // Notebook rules follow the text when it scrolls.
  await js(`{ const t = document.querySelector('#editor'); t.value = 'line\\n'.repeat(300); t.scrollTop = 137; }`);
  await sleep(100);
  check('ruled lines move with the scrolled text',
    await js('document.querySelector("#notebook").style.getPropertyValue("--scroll-y")'), '137px');

  // Text-width ruler: start narrow (4″) so both sheets are narrower than
  // their panes, then drag the editor's right marker 48px outward.
  await js('mdEditor.preferences.set("textWidth", 384)');
  await sleep(100);
  const marker = JSON.parse(await js(`JSON.stringify(document.querySelector('.pane--source .ruler__marker--right').getBoundingClientRect())`));
  const sheetBefore = await js(`document.querySelector('.pane--preview .page').getBoundingClientRect().width`);
  await app.drag(marker.x + marker.width / 2, marker.y + marker.height / 2, marker.x + marker.width / 2 + 48, marker.y + marker.height / 2);
  await sleep(100);
  check('dragging a ruler marker widens the text column by 2 × 48px',
    await js('mdEditor.preferences.get("textWidth")'), 480);
  check('…and the OTHER sheet follows (shared width)',
    await js(`document.querySelector('.pane--preview .page').getBoundingClientRect().width`) > sheetBefore, true);
  check('markers sit exactly on the text edge',
    await js(`(() => {
      const m = document.querySelector('.pane--source .ruler__marker--left').getBoundingClientRect();
      const t = document.querySelector('#editor');
      const left = t.getBoundingClientRect().left + parseFloat(getComputedStyle(t).paddingLeft);
      return Math.abs((m.left + m.width / 2) - left) < 1;
    })()`), true);
  await js(`document.querySelector('.ruler__marker').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
  check('double-click resets the width', await js('mdEditor.preferences.get("textWidth")'), 720);

  check('no errors or warnings in the console', app.consoleProblems, []);
  await app.close();
  return report();
}
