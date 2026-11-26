// The docs site build (ask A3, src/scripts/site/): the renderer's subset of Markdown, and a real build into a temp
// folder whose pages, Markdown twins and links all hold together.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { build, DOCS, PAGES } from '../scripts/site/build.mjs';
import { renderMarkdown } from '../scripts/site/markdown.mjs';

/** @param {string} text */
const html = text => renderMarkdown(text, { link: href => (href.startsWith('drop') ? null : href) }).html;

describe('site markdown', () => {
  it('escapes raw HTML instead of passing it through', () => {
    assert.equal(html('a <script>x</script> & b'), '<p>a &lt;script&gt;x&lt;/script&gt; &amp; b</p>');
  });

  it('renders a GFM table, with an escaped pipe and alignment', () => {
    const out = html('| A | B |\n| --- | :-: |\n| `a\\|b` | **c** |');
    assert.match(out, /<th>A<\/th><th style="text-align:center">B<\/th>/);
    assert.match(out, /<td><code>a\|b<\/code><\/td><td style="text-align:center"><strong>c<\/strong><\/td>/);
  });

  it('nests lists by indentation and keeps snake_case words whole', () => {
    assert.equal(html('- one_two_three\n  - inner\n- two'), '<ul><li>one_two_three\n<ul><li>inner</li></ul></li><li>two</li></ul>');
  });

  it('keeps the text of a link the resolver drops', () => {
    assert.equal(html('see [the file](drop/x.ts) and [kept](y.md)'), '<p>see the file and <a href="y.md">kept</a></p>');
  });

  it('gives headings GitHub anchors, numbered when repeated', () => {
    const { headings } = renderMarkdown('## 6. Budgets\n\n## Notes\n\n## Notes', { link: href => href });
    assert.deepEqual(
      headings.map(heading => heading.id),
      ['6-budgets', 'notes', 'notes-1'],
    );
  });

  it('drops HTML comments and keeps fenced code verbatim', () => {
    assert.equal(html('<!-- hidden -->\n```sh\na <b> **c**\n```'), '<pre><code class="language-sh">a &lt;b&gt; **c**</code></pre>');
  });
});

describe('site build', () => {
  /** @type {string} */
  let out = '';
  /** @type {Awaited<ReturnType<typeof build>>} */
  let result;

  before(async () => {
    out = mkdtempSync(join(tmpdir(), 'format-site-'));
    result = await build({ out, sha: '0123456789abcdef' });
  });

  after(() => {
    rmSync(out, { recursive: true, force: true });
  });

  it('writes both front doors and the agent endpoints', () => {
    for (const file of ['index.html', 'agents/index.html', 'agents/index.md', 'agents/skill.md', 'llms.txt', 'llms-full.txt', '404.html', 'version.json', '_headers']) {
      assert.ok(existsSync(join(out, file)), file);
    }
    for (const page of PAGES) assert.ok(existsSync(join(out, page.md)), page.md);
    for (const doc of DOCS) {
      assert.ok(existsSync(join(out, 'docs', doc.slug, 'index.html')), doc.slug);
      assert.ok(existsSync(join(out, 'docs', `${doc.slug}.md`)), doc.slug);
    }
  });

  it('reads the format version from code', async () => {
    const { SHARDFILE_VERSION } = await import('../format/version.ts');
    assert.equal(result.version.format, SHARDFILE_VERSION);
    assert.equal(JSON.parse(readFileSync(join(out, 'version.json'), 'utf8')).format, SHARDFILE_VERSION);
  });

  it('starts the skill with a SKILL.md front matter', () => {
    assert.match(readFileSync(join(out, 'agents/skill.md'), 'utf8'), /^---\nname: shard-format\ndescription: .+\n---\n/);
  });

  it('leaves no token unfilled and no site link dangling', () => {
    /** @param {string} dir @returns {string[]} */
    const files = dir => readdirSync(dir).flatMap(name => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]));
    for (const file of files(out)) {
      const text = readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /\{\{[\w.]+\}\}/, file);
      for (const [, path] of text.matchAll(/href="(\/[^"#?]*)/g)) {
        const target = path?.endsWith('/') ? join(out, path, 'index.html') : join(out, path ?? '');
        assert.ok(existsSync(target), `${file} links ${path}`);
      }
    }
  });
});
