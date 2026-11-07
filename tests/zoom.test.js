/**
 * Unit tests for zoom steps and the "plus/minus" keys.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepZoom, clampZoom } from '../src/js/ui/Workspace.js';
import { toAccelerator } from '../src/js/platform/desktop/DesktopMenu.js';

test('zoom steps up and down like TextEdit', () => {
  assert.equal(stepZoom(1, +1), 1.1);
  assert.equal(stepZoom(1, -1), 0.9);
  assert.equal(stepZoom(3, +1), 3, 'stays at the maximum');
  assert.equal(stepZoom(0.5, -1), 0.5, 'stays at the minimum');
});

test('from an in-between pinch value, the next step is the next listed one', () => {
  assert.equal(stepZoom(1.13, +1), 1.25);
  assert.equal(stepZoom(1.13, -1), 1.1);
});

test('pinch values are clamped and rounded to whole percent', () => {
  assert.equal(clampZoom(1.23456), 1.23);
  assert.equal(clampZoom(9), 3);
  assert.equal(clampZoom(0.1), 0.5);
});

test('zoom shortcuts map to menu accelerators', () => {
  assert.equal(toAccelerator('mod+plus'), 'CmdOrCtrl++');
  assert.equal(toAccelerator('mod+minus'), 'CmdOrCtrl+-');
  assert.equal(toAccelerator('mod+0'), 'CmdOrCtrl+0');
});
