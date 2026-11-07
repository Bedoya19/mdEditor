/**
 * Unit tests for the text-width ruler's maths (the DOM part is covered by
 * the end-to-end checks, which drag a real marker).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampWidth, widthAfterDrag, formatInches, TEXT_WIDTH } from '../src/js/ui/Ruler.js';

test('widths snap to ⅛ inch and stay within 3″–14″', () => {
  assert.equal(clampWidth(725), 720);
  assert.equal(clampWidth(10), TEXT_WIDTH.min);
  assert.equal(clampWidth(99999), TEXT_WIDTH.max);
});

test('dragging a marker outward widens by twice the distance (centred sheet)', () => {
  assert.equal(widthAfterDrag({ startWidth: 720, dx: 48, side: 'right' }), 816);
  assert.equal(widthAfterDrag({ startWidth: 720, dx: -48, side: 'left' }), 816);
  assert.equal(widthAfterDrag({ startWidth: 720, dx: -48, side: 'right' }), 624);
});

test('at 200 % zoom the same drag changes the document width half as much', () => {
  assert.equal(widthAfterDrag({ startWidth: 720, dx: 96, side: 'right', zoom: 2 }), 816);
});

test('inch labels', () => {
  assert.equal(formatInches(720), '7.5″');
  assert.equal(formatInches(672), '7″');
});
