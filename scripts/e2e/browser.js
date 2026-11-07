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
  check('ruler can be hidden', await js('document.querySelector("#ruler").hidden'), true);
  await js('mdEditor.commands.execute("view.toggleRuler")');

  check('no errors or warnings in the console', app.consoleProblems, []);
  await app.close();
  return report();
}
