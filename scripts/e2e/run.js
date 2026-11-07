/**
 * @file run.js — runs every end-to-end scenario.   npm run test:e2e
 * Needs Google Chrome installed (or CHROME_PATH) and Node 22+.
 */
import { runBrowserChecks } from './browser.js';
import { runDesktopChecks } from './desktop.js';

const failed = (await runBrowserChecks()) + (await runDesktopChecks());
process.exit(failed ? 1 : 0);
