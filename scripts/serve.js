/**
 * @file serve.js — tiny static file server for development.  Run: npm start
 *
 * WHY IS A SERVER NEEDED AT ALL?
 * Browsers refuse to load ES modules (`<script type="module">`) from file://
 * URLs for security reasons, so double-clicking index.html shows a blank
 * page. Any static server works (`python3 -m http.server` too); this one has
 * zero dependencies and opens the browser for you.
 *
 * It listens on 127.0.0.1 only, so nothing is exposed to your network.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

// The web app lives in src/ (the same folder Tauri packages for the desktop app).
const ROOT = resolve(fileURLToPath(new URL('../src', import.meta.url)));
const HOST = '127.0.0.1';
const FIRST_PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const filePath = normalize(join(ROOT, urlPath === '/' ? 'index.html' : urlPath));

  // Block "../" tricks: only files inside the project folder are served.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store', // always see your latest edits
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});

/** Try 8080, 8081… until a free port is found. */
function listen(port) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < FIRST_PORT + 20) listen(port + 1);
    else throw error;
  });
  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}/`;
    console.log(`Markdown Editor running at ${url}  (Ctrl+C to stop)`);
    if (!process.env.NO_OPEN) openBrowser(url);
  });
}

function openBrowser(url) {
  const command = { darwin: 'open', win32: 'start ""' }[process.platform] ?? 'xdg-open';
  exec(`${command} ${url}`, () => {}); // best effort; ignore failures
}

listen(FIRST_PORT);
