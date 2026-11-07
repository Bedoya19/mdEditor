/**
 * Unit tests for the Markdown engine. Run with:  npm test
 * Uses Node's built-in test runner — no dependencies to install.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownParser } from '../src/js/markdown/MarkdownParser.js';

const md = new MarkdownParser();
const render = (src) => md.parse(src);

test('headings (ATX and setext) get ids', () => {
  assert.equal(render('# Hello World'), '<h1 id="hello-world">Hello World</h1>');
  assert.equal(render('### Three ###'), '<h3 id="three">Three</h3>');
  assert.equal(render('Title\n====='), '<h1 id="title">Title</h1>');
  assert.equal(render('Sub\n---'), '<h2 id="sub">Sub</h2>');
});

test('paragraphs and hard breaks', () => {
  assert.equal(render('one\ntwo'), '<p>one\ntwo</p>');
  assert.equal(render('one  \ntwo'), '<p>one<br>\ntwo</p>');
  assert.equal(render('a\n\nb'), '<p>a</p>\n<p>b</p>');
});

test('inline formatting', () => {
  assert.equal(render('**b** *i* ~~s~~ `c`'), '<p><strong>b</strong> <em>i</em> <del>s</del> <code>c</code></p>');
  assert.equal(render('_i_ and snake_case_name'), '<p><em>i</em> and snake_case_name</p>');
  assert.equal(render('***both***'), '<p><strong><em>both</em></strong></p>');
});

test('code spans are not formatted inside', () => {
  assert.equal(render('`**not bold**`'), '<p><code>**not bold**</code></p>');
});

test('nested inline inside bold keeps code spans (shared stash)', () => {
  assert.equal(render('**a `b` c**'), '<p><strong>a <code>b</code> c</strong></p>');
});

test('links, images, autolinks', () => {
  assert.equal(
    render('[site](https://a.com/x_y_z "T")'),
    '<p><a href="https://a.com/x_y_z" title="T" target="_blank" rel="noopener noreferrer">site</a></p>',
  );
  assert.equal(render('[**b**](#top)'), '<p><a href="#top"><strong>b</strong></a></p>');
  assert.equal(render('![cat](img/cat.png)'), '<p><img src="img/cat.png" alt="cat" loading="lazy"></p>');
  assert.match(render('<https://x.io>'), /<a href="https:\/\/x.io"[^>]*>https:\/\/x.io<\/a>/);
});

test('security: raw HTML is escaped and javascript: URLs are neutralised', () => {
  assert.equal(render('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.match(render('[x](javascript:alert(1))'), /href="#"/);
  assert.match(render('[x](JaVaScRiPt:alert)'), /href="#"/);
  assert.match(render('![x](data:text/html,hi)'), /src="#"/);
  assert.equal(render('"quotes" & \'apos\''), '<p>&quot;quotes&quot; &amp; &#39;apos&#39;</p>');
});

test('backslash escapes', () => {
  assert.equal(render('\\*not italic\\*'), '<p>*not italic*</p>');
});

test('fenced and indented code', () => {
  assert.equal(render('```js\nconst a = 1 < 2;\n```'), '<pre><code class="language-js">const a = 1 &lt; 2;</code></pre>');
  assert.equal(render('    indented\n    code'), '<pre><code>indented\ncode</code></pre>');
  assert.equal(render('```\nunclosed'), '<pre><code>unclosed</code></pre>');
});

test('blockquotes nest blocks and support lazy lines', () => {
  assert.equal(render('> # T\n> text\nlazy'), '<blockquote>\n<h1 id="t">T</h1>\n<p>text\nlazy</p>\n</blockquote>');
});

test('tight, loose, ordered and nested lists', () => {
  assert.equal(render('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
  assert.equal(render('- a\n\n- b'), '<ul>\n<li><p>a</p></li>\n<li><p>b</p></li>\n</ul>');
  assert.equal(render('3. a\n4. b'), '<ol start="3">\n<li>a</li>\n<li>b</li>\n</ol>');
  assert.equal(render('- a\n  - b\n- c'), '<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul></li>\n<li>c</li>\n</ul>');
});

test('lists end before a following paragraph', () => {
  assert.equal(render('- a\n\nafter'), '<ul>\n<li>a</li>\n</ul>\n<p>after</p>');
});

test('task lists', () => {
  assert.equal(
    render('- [ ] todo\n- [x] done'),
    '<ul>\n<li class="task-list-item"><input type="checkbox" disabled> todo</li>\n'
      + '<li class="task-list-item"><input type="checkbox" disabled checked> done</li>\n</ul>',
  );
});

test('horizontal rules win over lists', () => {
  assert.equal(render('* * *'), '<hr>');
  assert.equal(render('a\n\n---'), '<p>a</p>\n<hr>');
});

test('tables with alignment', () => {
  const html = render('| A | B |\n|:--|--:|\n| 1 | **2** |');
  assert.equal(
    html,
    '<table>\n<thead><tr><th style="text-align:left">A</th><th style="text-align:right">B</th></tr></thead>\n'
      + '<tbody><tr><td style="text-align:left">1</td><td style="text-align:right"><strong>2</strong></td></tr></tbody>\n</table>',
  );
});

test('front matter is shown separately, not parsed as content', () => {
  assert.equal(render('---\ntitle: x\n---\n# H'), '<pre class="front-matter"><code>title: x</code></pre>\n<h1 id="h">H</h1>');
});

test('windows line endings and tabs', () => {
  assert.equal(render('# A\r\n\r\ntext'), '<h1 id="a">A</h1>\n<p>text</p>');
});

test('never hangs on odd input', () => {
  for (const src of ['', '\n\n', '-', '>', '|', '```', '#', '1.', '- [ ]', '* * *\n- ']) {
    assert.equal(typeof render(src), 'string');
  }
});
