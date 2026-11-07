/**
 * @file harness.js — shared machinery for the end-to-end checks.
 *
 * Starts the dev server and a headless Google Chrome, opens the app, and
 * returns small helpers to drive it through the Chrome DevTools Protocol.
 * No dependencies: Node's built-in fetch + WebSocket (Node 22+).
 *
 * Chrome's location can be overridden with the CHROME_PATH env variable.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {Object} options
 * @param {number} options.appPort
 * @param {number} options.debugPort
 * @param {string} [options.initScript]  JS run in the page BEFORE the app's own code
 *   (used to inject a fake `window.__TAURI__`).
 */
export async function openApp({ appPort, debugPort, initScript }) {
  const server = spawn(process.execPath, [fileURLToPath(new URL('../serve.js', import.meta.url))], {
    env: { ...process.env, PORT: String(appPort), NO_OPEN: '1' },
    stdio: 'ignore',
  });
  const profile = mkdtempSync(join(tmpdir(), 'mdeditor-e2e-'));
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });

  /** Stop Chrome and the server; delete the throwaway profile once Chrome lets go of it. */
  async function close() {
    server.kill();
    if (chrome.exitCode === null) {
      chrome.kill();
      await once(chrome, 'exit');
    }
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch { /* a leftover temp folder is harmless; never fail the run for it */ }
  }

  let page;
  for (let i = 0; i < 50 && !page; i++) {
    await sleep(200);
    try {
      page = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find((t) => t.type === 'page');
    } catch { /* Chrome still starting */ }
  }
  if (!page) { await close(); throw new Error(`Couldn't start Chrome at ${CHROME}`); }

  /* ── Tiny DevTools Protocol client ── */
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve));
  let nextId = 0;
  const pending = new Map();
  const consoleProblems = [];
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) pending.get(msg.id)?.(msg);
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleProblems.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      consoleProblems.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  if (initScript) await send('Page.addScriptToEvaluateOnNewDocument', { source: initScript });
  await send('Page.navigate', { url: `http://127.0.0.1:${appPort}/` });
  await sleep(1500);

  const js = async (expression) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const press = async (key, code, modifiers = 0, text) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, text });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers });
  };

  return {
    js,
    press,
    enter: () => press('Enter', 'Enter', 0, '\r'),
    type: (text) => send('Input.insertText', { text }),
    value: () => js('document.querySelector("#editor").value'),
    select: (start, end) => js(`document.querySelector("#editor").setSelectionRange(${start}, ${end})`),
    consoleProblems,
    /** Saves a PNG of the page (or of `clip` = {x, y, width, height, scale}). Handy when debugging a check. */
    screenshot: async (file, clip) => {
      const { result } = await send('Page.captureScreenshot', clip ? { clip } : {});
      writeFileSync(file, Buffer.from(result.data, 'base64'));
    },
    close: async () => { ws.close(); await close(); },
  };
}

/** Collects PASS/FAIL lines; `report()` prints them and returns the failure count. */
export function createChecks(title) {
  const results = [];
  return {
    check(name, actual, expected) {
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      results.push({
        ok,
        line: `${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got      ${JSON.stringify(actual)}\n      expected ${JSON.stringify(expected)}`}`,
      });
    },
    report() {
      const failed = results.filter((r) => !r.ok).length;
      console.log(`\n── ${title} ──`);
      results.forEach(({ line }) => console.log(line));
      console.log(`${results.length - failed}/${results.length} checks passed`);
      return failed;
    },
  };
}
