/**
 * Unit tests for the file workflow (New / Open / Save / Close + "Save changes?").
 * Every collaborator is a fake, which is exactly what Dependency Inversion buys:
 * the controller can be tested without a browser, Tauri or a disk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentController } from '../src/js/app/DocumentController.js';
import { MarkdownDocument } from '../src/js/model/MarkdownDocument.js';

function setup({ answer = 'cancel', canClose = true, canSaveInPlace = true } = {}) {
  const doc = new MarkdownDocument();
  doc.load({ content: 'saved', name: 'a.md', fileRef: '/a.md' });
  const log = [];
  let guard;
  const files = {
    capabilities: { canSaveInPlace },
    open: async () => ({ name: 'b.md', content: 'B', fileRef: '/b.md' }),
    openIncoming: async (paths) => ({ name: 'c.md', content: `from ${paths[0]}`, fileRef: paths[0] }),
    save: async ({ name, fileRef }) => { log.push('save'); return { name, fileRef }; },
    saveAs: async () => null,
  };
  const windowService = {
    capabilities: { canClose },
    close: () => log.push('window closed'),
    guardClose: (handlers) => { guard = handlers; },
  };
  const controller = new DocumentController({
    document: doc,
    files,
    windowService,
    ask: async () => { log.push('asked'); return answer; },
    notify: (message) => log.push(`notify: ${message}`),
  });
  return { doc, log, controller, guard: () => guard };
}

test('clean document: open replaces it without asking', async () => {
  const { doc, log, controller } = setup();
  await controller.open();
  assert.equal(doc.content, 'B');
  assert.ok(!log.includes('asked'));
});

test('dirty + Cancel: nothing changes', async () => {
  const { doc, log, controller } = setup({ answer: 'cancel' });
  doc.setContent('edited');
  await controller.open();
  assert.equal(doc.content, 'edited');
  assert.ok(log.includes('asked'));
});

test("dirty + Don't Save: replaced, not saved", async () => {
  const { doc, log, controller } = setup({ answer: 'discard' });
  doc.setContent('edited');
  await controller.newDocument();
  assert.equal(doc.content, '');
  assert.ok(!log.includes('save'));
});

test('dirty + Save: saved first, then replaced', async () => {
  const { doc, log, controller } = setup({ answer: 'save' });
  doc.setContent('edited');
  await controller.open();
  assert.deepEqual(log.slice(0, 2), ['asked', 'save']);
  assert.equal(doc.content, 'B');
});

test('close on desktop: asks if dirty, then closes the real window', async () => {
  const { doc, log, controller } = setup({ answer: 'discard', canClose: true });
  doc.setContent('edited');
  await controller.close();
  assert.deepEqual(log, ['asked', 'window closed']);
});

test('close in a browser tab: falls back to closing the document', async () => {
  const { doc, log, controller } = setup({ canClose: false });
  await controller.close();
  assert.equal(doc.name, 'Untitled.md');
  assert.ok(!log.includes('window closed'));
});

test('the window guard routes OS close requests to close()', async () => {
  const { log, guard } = setup();
  await guard().requestClose();
  assert.deepEqual(log, ['window closed']);
  assert.equal(guard().hasUnsavedWork(), false);
});

test('openIncoming forwards the opaque payload to the FileService', async () => {
  const { doc, controller } = setup();
  await controller.openIncoming(['/x/dropped.md']);
  assert.equal(doc.content, 'from /x/dropped.md');
  assert.equal(doc.fileRef, '/x/dropped.md');
});

test('a second close while the sheet is open is ignored (no double sheet)', async () => {
  const { doc, log, controller } = setup({ answer: 'cancel' });
  doc.setContent('edited');
  await Promise.all([controller.close(), controller.close()]);
  assert.equal(log.filter((entry) => entry === 'asked').length, 1);
});
