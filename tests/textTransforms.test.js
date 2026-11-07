/**
 * Unit tests for the editor's pure text transforms. Run with:  npm test
 *
 * Helper notation: a string with "|" marks the caret, "[...]" a selection.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as t from '../src/js/editor/textTransforms.js';

/** "ab[cd]ef" → { text: 'abcdef', start: 2, end: 4 };  "ab|c" → caret at 2 */
function state(marked) {
  const caret = marked.indexOf('|');
  if (caret !== -1) return { text: marked.replace('|', ''), start: caret, end: caret };
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return { text: marked.replace('[', '').replace(']', ''), start, end };
}

/** Applies a TextEdit and renders the result back in the same notation. */
function apply(s, edit) {
  if (!edit) return null;
  const text = s.text.slice(0, edit.from) + edit.insert + s.text.slice(edit.to);
  if (edit.selectStart === edit.selectEnd) return `${text.slice(0, edit.selectStart)}|${text.slice(edit.selectStart)}`;
  return `${text.slice(0, edit.selectStart)}[${text.slice(edit.selectStart, edit.selectEnd)}]${text.slice(edit.selectEnd)}`;
}

const run = (fn, marked, ...args) => {
  const s = state(marked);
  return apply(s, fn(s, ...args));
};

test('toggleWrap wraps, unwraps (both ways) and uses a placeholder', () => {
  assert.equal(run(t.toggleWrap, 'a [word] b', '**'), 'a **[word]** b');
  assert.equal(run(t.toggleWrap, 'a **[word]** b', '**'), 'a [word] b');
  assert.equal(run(t.toggleWrap, 'a [**word**] b', '**'), 'a [word] b');
  assert.equal(run(t.toggleWrap, 'a | b', '*', 'italic'), 'a *[italic]* b');
});

test('insertLink selects the URL to type', () => {
  assert.equal(run(t.insertLink, '[docs]'), '[docs]([https://])');
  assert.equal(run(t.insertLink, '[https://x.io]'), '[[link text]](https://x.io)');
});

test('setLinePrefix replaces existing block prefixes', () => {
  assert.equal(run(t.setLinePrefix, 'ti|tle', '# '), '# title|');
  assert.equal(run(t.setLinePrefix, '## ti|tle', '> '), '> title|');
  assert.equal(run(t.setLinePrefix, '# ti|tle', ''), 'title|');
  assert.equal(run(t.setLinePrefix, '[one\n\ntwo]', '## '), '[## one\n\n## two]');
});

test('setLinePrefix on an empty line inserts the prefix (ready to type)', () => {
  assert.equal(run(t.setLinePrefix, 'a\n|', '# '), 'a\n# |');
});

test('toggleList applies, numbers and removes', () => {
  assert.equal(run(t.toggleList, '[a\nb]', 'bullet'), '[- a\n- b]');
  assert.equal(run(t.toggleList, '[a\n\nb]', 'ordered'), '[1. a\n\n2. b]');
  assert.equal(run(t.toggleList, '[- a\n- b]', 'bullet'), '[a\nb]');
  assert.equal(run(t.toggleList, '[- a]', 'task'), '[- [ ] a]');
});

test('toggleCodeBlock wraps and unwraps', () => {
  assert.equal(run(t.toggleCodeBlock, '[x = 1]'), '[```\nx = 1\n```]');
  assert.equal(run(t.toggleCodeBlock, '[```\nx = 1\n```]'), '[x = 1]');
});

test('insertBlock surrounds snippets with blank lines', () => {
  assert.equal(run(t.insertBlock, 'para|', '---'), 'para\n\n[---]\n\n');
});

test('continueList continues bullets, numbers, tasks and quotes', () => {
  assert.equal(run(t.continueList, '- item|'), '- item\n- |');
  assert.equal(run(t.continueList, '  9) item|'), '  9) item\n  10) |');
  assert.equal(run(t.continueList, '- [x] done|'), '- [x] done\n- [ ] |');
  assert.equal(run(t.continueList, '> quote|'), '> quote\n> |');
});

test('continueList ends the list on an empty item, ignores plain lines', () => {
  assert.equal(run(t.continueList, 'a\n- |'), 'a\n|');
  assert.equal(run(t.continueList, 'plain|'), null);
});

test('indent and outdent', () => {
  assert.equal(run(t.indentLines, '- a|'), '  - a|');
  assert.equal(run(t.outdentLines, '  - a|'), '- a|');
  assert.equal(run(t.indentLines, '[a\nb]'), '[  a\n  b]');
});

test('detectLinePrefix', () => {
  assert.equal(t.detectLinePrefix(state('## He|llo')), '## ');
  assert.equal(t.detectLinePrefix(state('> q|')), '> ');
  assert.equal(t.detectLinePrefix(state('plain|')), '');
});
