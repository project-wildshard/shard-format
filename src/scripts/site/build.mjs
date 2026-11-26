#!/usr/bin/env node
// Builds the format docs site (format.wildshard.io, ask A3) into src/site/dist: static HTML for people, raw Markdown,
// /llms.txt and /llms-full.txt for agents. docs/ stays the single source: each reference page is a docs/*.md rendered
// as it is, and src/site/pages/ holds the few hand-written pages (the two front doors, the tour, the glossary, the
// agent skill). The public GitHub repo's source is the spec; the site only explains it.
//
//   node src/scripts/site/build.mjs [--out <dir>]     # default src/site/dist (gitignored)
//
// Links: a docs/ link to a published doc becomes its page (HTML) or its absolute .md URL (Markdown); a link to any
// other file the repo tracks goes to GitHub; a link to a file the repo doesn't have (singleplayer-era paths) keeps
// its text and loses the link. Hand-written pages link site paths (`/tour/`) and `repo:<path>`; a bad one fails the
// build. Deploy: src/scripts/site/deploy.sh (docs/dev.md, "Docs site").
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { escapeHtml, plainText, renderMarkdown } from './markdown.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const SITE = join(ROOT, 'src', 'site');
export const ORIGIN = process.env.SITE_ORIGIN ?? 'https://format.wildshard.io';
export const GITHUB = 'https://github.com/project-wildshard/shard-format';
const TOUR_SHARD = 'corpus/exports/brasscap-mesa';

/** The reference pages: docs/ files published as they are, in reading order. */
export const DOCS = [
  { file: 'docs/SHARDFILE.md', slug: 'shardfile', title: 'Shard file fields', blurb: 'What `shard.json` and its sections may say: every field, its bounds, the 500 m cube and its entryways.' },
  { file: 'docs/RUNTIME-CONTRACT.md', slug: 'runtime-contract', title: 'Runtime contract', blurb: 'Which sections, client-plan kinds, server hosts and named files a shard may declare, which engine host runs each, the budgets and the limits. Mostly generated from code.' },
  { file: 'docs/SCRIPT-ABI.md', slug: 'script-abi', title: 'Script ABI', blurb: 'The Wasm a shard ships as its only code: imports, exports, the IO block, sides, fuel and admission.' },
  { file: 'docs/PLATFORM-FILE-FAMILIES.md', slug: 'platform-file-families', title: 'Named file families', blurb: 'The registered streamed JSON file families and the schema that defines each.' },
  { file: 'docs/preparation.md', slug: 'preparation', title: 'Preparation', blurb: '`cook.json` and `validation.json`: what an author computes before upload, and the preparation spec version.' },
  { file: 'docs/VALIDATION-CODES.md', slug: 'validation-codes', title: 'Validation codes', blurb: 'Every stable refusal and report code the validator gives. Generated from code.' },
  { file: 'docs/audio.md', slug: 'audio', title: 'Audio targets', blurb: 'What audio to ship in a shard, the budget and the checks that hold it.' },
  { file: 'docs/CREATURE-LAYERS.md', slug: 'creature-layers', title: 'Species layers', blurb: 'The optional layers a species row may carry: type, body, temperament, senses, abilities.' },
  { file: 'docs/wire.md', slug: 'wire', title: 'The wire', blurb: '`@wildshard/wire`: versions, framing and the rules for changing the network protocol.' },
  { file: 'docs/ONE-WAY.md', slug: 'one-way', title: 'One way', blurb: 'The ceilings that keep one shard format: counted legacy paths may only fall.' },
];

/** The hand-written pages under src/site/pages/. */
export const PAGES = [
  { file: 'src/site/pages/index.md', url: '/', md: '/index.md', title: 'What a shard file is', nav: 'Home' },
  { file: 'src/site/pages/tour.md', url: '/tour/', md: '/tour.md', title: 'Tour of a built shard', nav: 'Tour' },
  { file: 'src/site/pages/glossary.md', url: '/glossary/', md: '/glossary.md', title: 'Glossary', nav: 'Glossary' },
  { file: 'src/site/pages/agents.md', url: '/agents/', md: '/agents/index.md', title: 'For agents', nav: 'For agents' },
  { file: 'src/site/pages/skill.md', url: '/agents/skill/', md: '/agents/skill.md', title: 'Agent skill: validate and inspect a shard file', nav: '' },
];

const NAV = [
  { url: '/', label: 'Home' },
  { url: '/tour/', label: 'Tour' },
  { url: '/docs/', label: 'Reference' },
  { url: '/glossary/', label: 'Glossary' },
  { url: '/agents/', label: 'For agents' },
];

/** @param {string} file */
function read(file) {
  return readFileSync(join(ROOT, file), 'utf8');
}

/** @param {string[]} args */
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/** Files and folders the repo tracks, so a link to GitHub never 404s. */
function trackedPaths() {
  /** @type {Set<string>} */
  const paths = new Set();
  let listed = '';
  try {
    listed = git(['ls-files']);
  } catch {
    // An export without .git (deploy.sh builds from `git archive`): trust the tree on disk.
    return null;
  }
  for (const file of listed.split('\n')) {
    paths.add(file);
    for (let dir = posix.dirname(file); dir !== '.'; dir = posix.dirname(dir)) paths.add(dir);
  }
  return paths;
}

/** @param {number} bytes */
function size(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${bytes} B`;
}

/** The tour's numbers, read from the built shard the tests hold, so they stay true when it is re-exported. */
function tourFacts() {
  const index = JSON.parse(read(`${TOUR_SHARD}/shard.json`));
  const pin = JSON.parse(read(`${TOUR_SHARD}.pin.json`));
  /** @type {Map<string, { count: number, bytes: number }>} */
  const kinds = new Map();
  for (const file of index.files) {
    const kind = kinds.get(file.kind) ?? { count: 0, bytes: 0 };
    kind.count += 1;
    kind.bytes += file.compressed;
    kinds.set(file.kind, kind);
  }
  const sections = index.sections.map(
    (/** @type {{ name: string, bytes: number }} */ section) => `| \`${section.name}\` | ${size(section.bytes)} |`,
  );
  const blobs = [...kinds.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, { count, bytes }]) => `| \`${kind}\` | ${count} | ${size(bytes)} |`);
  const { budgets } = index.admission;
  return {
    '{{tour.name}}': index.identity.name,
    '{{tour.slug}}': index.identity.slug,
    '{{tour.formatVersion}}': index.formatVersion,
    '{{tour.engine}}': index.requires.engine,
    '{{tour.sectionCount}}': String(index.sections.length),
    '{{tour.fileCount}}': String(index.files.length),
    '{{tour.criticalCount}}': String(index.admission.critical.length),
    '{{tour.libraryWire}}': size(budgets.library.compressed),
    '{{tour.simWire}}': size(budgets.sim.compressed),
    '{{tour.players}}': String(index.admission.authorCaps.players),
    '{{tour.speed}}': String(index.admission.authorCaps.speed),
    '{{tour.commit}}': pin.commit.slice(0, 12),
    '{{tour.omitted}}': String(pin.omitted?.files?.length ?? 0),
    '{{tour.repo}}': pin.repo,
    '{{tour.sections}}': ['| Section | Bytes |', '| --- | --- |', ...sections].join('\n'),
    '{{tour.blobs}}': ['| Kind | Files | Wire bytes |', '| --- | --- | --- |', ...blobs].join('\n'),
  };
}

/** Rewrites the link targets in Markdown source, outside code. @param {string} markdown @param {(href: string) => string | null} link */
function rewriteMarkdownLinks(markdown, link) {
  let fenced = false;
  return markdown
    .split('\n')
    .map(line => {
      if (/^\s*(`{3,}|~{3,})/.test(line)) fenced = !fenced;
      if (fenced) return line;
      return line.replaceAll(/(!?)\[((?:[^\]`]|`[^`]*`)*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (whole, bang, label, href, title, offset) => {
        const ticks = (line.slice(0, offset).match(/`/g) ?? []).length;
        if (ticks % 2 === 1) return whole;
        const target = link(href);
        return target === null ? label : `${bang}[${label}](${target}${title})`;
      });
    })
    .join('\n');
}

/**
 * The link resolver for one source file.
 * @param {string} from repo path of the Markdown file
 * @param {'html' | 'md'} mode
 * @param {{ tracked: Set<string> | null, routes: Map<string, string>, dropped: string[] }} context
 */
function linker(from, mode, context) {
  const docs = new Map(DOCS.map(doc => [doc.file, doc]));
  /** @param {string} path */
  const exists = path => (context.tracked ? context.tracked.has(path) : existsSync(join(ROOT, path)));
  /** @param {string} path @param {string} hash */
  const github = (path, hash) => {
    const dir = statSync(join(ROOT, path)).isDirectory();
    return `${GITHUB}/${dir ? 'tree' : 'blob'}/main/${path}${hash}`;
  };
  return (/** @type {string} */ href) => {
    if (href.startsWith('#') || /^(https?|mailto):/i.test(href)) return href;
    const hashAt = href.indexOf('#');
    const path = hashAt === -1 ? href : href.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : href.slice(hashAt);
    if (path.startsWith('repo:')) {
      const target = path.slice('repo:'.length).replace(/\/$/, '');
      if (!exists(target)) throw new Error(`${from}: ${href} names a file the repo doesn't have`);
      return github(target, hash);
    }
    if (path.startsWith('/')) {
      const twin = context.routes.get(path);
      if (twin === undefined) throw new Error(`${from}: ${href} is not a page of this site`);
      return mode === 'html' ? href : `${ORIGIN}${twin}${hash}`;
    }
    const target = posix.normalize(posix.join(posix.dirname(from), path)).replace(/\/$/, '');
    const doc = docs.get(target);
    if (doc) return mode === 'html' ? `/docs/${doc.slug}/${hash}` : `${ORIGIN}/docs/${doc.slug}.md${hash}`;
    if (!target.startsWith('..') && exists(target)) return github(target, hash);
    context.dropped.push(`${from}: ${href}`);
    return null;
  };
}

/** @param {string} text */
function frontMatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return { body: text, fields: {} };
  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const field = /^(\w+):\s*(.*)$/.exec(line);
    if (field) fields[field[1] ?? ''] = field[2] ?? '';
  }
  return { body: text.slice(match[0].length), fields };
}

/**
 * @param {{ title: string, description: string, url: string, md: string, body: string, version: { format: string, package: string, sha: string }, source?: string }} page
 */
function layout(page) {
  const nav = NAV.map(item => {
    const current = item.url === '/' ? page.url === '/' : page.url.startsWith(item.url);
    return `<a href="${item.url}"${current ? ' aria-current="page"' : ''}>${item.label}</a>`;
  }).join('');
  const source = page.source ? ` · <a href="${GITHUB}/blob/main/${page.source}">source</a>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)} · Shard format</title>
<meta name="description" content="${escapeHtml(page.description)}">
<meta name="color-scheme" content="light dark">
<link rel="stylesheet" href="/style.css">
<link rel="alternate" type="text/markdown" href="${page.md}" title="This page as Markdown">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M8 1 14 6 8 15 2 6Z' fill='%2337a'/%3E%3C/svg%3E">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site">
<div class="bar">
<a class="brand" href="/"><span aria-hidden="true">◆</span> Shard format</a>
<span class="version" title="Format version (src/format/version.ts) and npm package version">format ${escapeHtml(page.version.format)} · npm ${escapeHtml(page.version.package)}</span>
</div>
<nav aria-label="Site">${nav}</nav>
</header>
<main id="main">
${page.body}
</main>
<footer class="site">
<p><strong>The source is the spec.</strong> This site explains the format; where it and
<a href="${GITHUB}">the code on GitHub</a> disagree, the code is right.</p>
<p><a href="${page.md}">This page as Markdown</a> · <a href="/llms.txt">llms.txt</a>${source} · built from <a href="${GITHUB}/commit/${escapeHtml(page.version.sha)}"><code>${escapeHtml(page.version.sha.slice(0, 12))}</code></a></p>
</footer>
</body>
</html>
`;
}

/** @param {{ level: number, id: string, text: string }[]} headings */
function contents(headings) {
  const items = headings.filter(heading => heading.level === 2);
  if (items.length < 3) return '';
  const list = items.map(heading => `<li><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></li>`).join('');
  return `<details class="toc"><summary>On this page</summary><ol>${list}</ol></details>`;
}

/** Puts `extra` (a note, the contents) right after the page's title. @param {string} html @param {string} extra */
function afterTitle(html, extra) {
  const end = html.indexOf('</h1>');
  return end === -1 ? `${extra}\n${html}` : `${html.slice(0, end + 5)}\n${extra}${html.slice(end + 5)}`;
}

/** @param {string} dir @param {string} url @param {string} text */
function writeAt(dir, url, text) {
  const file = url.endsWith('/') ? join(dir, url, 'index.html') : join(dir, url);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** @param {{ out: string, sha?: string }} options */
export async function build(options) {
  const out = resolve(options.out);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const { SHARDFILE_VERSION } = await import(join(ROOT, 'src', 'format', 'version.ts'));
  const pkg = JSON.parse(read('package.json'));
  let sha = options.sha ?? process.env.SITE_BUILD_SHA ?? '';
  if (!sha) {
    try {
      sha = git(['rev-parse', 'HEAD']);
    } catch {
      sha = 'unknown';
    }
  }
  const version = { format: String(SHARDFILE_VERSION), package: String(pkg.version), sha };
  /** @type {Map<string, string>} html route -> its Markdown twin */
  const routes = new Map([
    ['/docs/', '/docs/index.md'],
    ['/llms.txt', '/llms.txt'],
    ['/llms-full.txt', '/llms-full.txt'],
    ...PAGES.map(page => /** @type {[string, string]} */ ([page.url, page.md])),
    ...PAGES.map(page => /** @type {[string, string]} */ ([page.md, page.md])),
    ...DOCS.map(doc => /** @type {[string, string]} */ ([`/docs/${doc.slug}/`, `/docs/${doc.slug}.md`])),
    ...DOCS.map(doc => /** @type {[string, string]} */ ([`/docs/${doc.slug}.md`, `/docs/${doc.slug}.md`])),
  ]);
  const context = { tracked: trackedPaths(), routes, dropped: /** @type {string[]} */ ([]) };
  const tokens = {
    '{{formatVersion}}': version.format,
    '{{packageVersion}}': version.package,
    '{{origin}}': ORIGIN,
    '{{github}}': GITHUB,
    ...tourFacts(),
  };
  /** @param {string} text */
  const fill = text => text.replaceAll(/\{\{[\w.]+\}\}/g, token => {
    const value = /** @type {Record<string, string>} */ (tokens)[token];
    if (value === undefined) throw new Error(`unknown site token ${token}`);
    return value;
  });

  /** @type {{ title: string, md: string, text: string }[]} */
  const everything = [];

  for (const page of PAGES) {
    const raw = fill(read(page.file));
    const { body, fields } = frontMatter(raw);
    const { html, headings } = renderMarkdown(body, { link: linker(page.file, 'html', context) });
    const description = fields.description ?? plainText(body.split('\n').find(line => line.trim() !== '' && !line.startsWith('#')) ?? page.title);
    const pageBody = page.url === '/' ? html : afterTitle(html, contents(headings));
    writeAt(out, page.url, layout({ title: page.title, description, url: page.url, md: page.md, body: `<article class="prose">${pageBody}</article>`, version, source: page.file }));
    const markdown = rewriteMarkdownLinks(raw, linker(page.file, 'md', context));
    writeAt(out, page.md, markdown);
    everything.push({ title: page.title, md: page.md, text: markdown });
  }

  for (const doc of DOCS) {
    let raw = read(doc.file);
    const url = `/docs/${doc.slug}/`;
    const md = `/docs/${doc.slug}.md`;
    const { html, headings } = renderMarkdown(raw, { link: linker(doc.file, 'html', context) });
    const note = `<p class="note">Reference, rendered from <a href="${GITHUB}/blob/main/${doc.file}"><code>${doc.file}</code></a> as it stands at this build. Its links to code go to GitHub; the code is the spec.</p>`;
    writeAt(out, url, layout({ title: doc.title, description: plainText(doc.blurb), url, md, body: `<article class="prose doc">${afterTitle(html, `${note}${contents(headings)}`)}</article>`, version, source: doc.file }));
    raw = rewriteMarkdownLinks(raw, linker(doc.file, 'md', context));
    const header = `<!-- ${ORIGIN}${md}: ${doc.file} from ${GITHUB} at ${sha}. The repo's source is the spec. -->\n`;
    writeAt(out, md, header + raw);
    everything.push({ title: doc.title, md, text: raw });
  }

  const docList = DOCS.map(doc => `- [${doc.title}](/docs/${doc.slug}/) (\`${doc.file}\`): ${doc.blurb}`).join('\n');
  const docsIndex = `# Reference\n\nThe repo's own docs, rendered as they are. Each page names its source file; the code in [the GitHub repo](${GITHUB}) is the spec, and these pages explain it. Format version ${version.format}.\n\n${docList}\n`;
  const docsRendered = renderMarkdown(docsIndex, { link: linker('src/site/pages/index.md', 'html', context) });
  writeAt(out, '/docs/', layout({ title: 'Reference', description: 'The shard format reference docs, rendered from the repo.', url: '/docs/', md: '/docs/index.md', body: `<article class="prose">${docsRendered.html}</article>`, version }));
  writeAt(out, '/docs/index.md', rewriteMarkdownLinks(docsIndex, linker('src/site/pages/index.md', 'md', context)));

  const llms = [
    '# Shard format',
    '',
    `> The Wildshard shard file format: what a built shard (a \`shard.json\` index, its sections and content-addressed blobs) may contain, and the validator that admits it. Format version ${version.format}, npm \`@wildshard/shard-format\` ${version.package}. The source in ${GITHUB} is the spec; these pages explain it.`,
    '',
    'Every page here is also plain Markdown: the URLs below are the Markdown copies.',
    '',
    '## Start here',
    '',
    `- [For agents](${ORIGIN}/agents/index.md): what to read for which job, and the rules that bite`,
    `- [Agent skill: validate and inspect a shard file](${ORIGIN}/agents/skill.md): a SKILL.md for the \`shard-format\` CLI`,
    '',
    '## Explanation',
    '',
    `- [What a shard file is](${ORIGIN}/index.md): the pipeline, how gameplay gets in, budgets`,
    `- [Tour of a built shard](${ORIGIN}/tour.md): every file in a real built shard's folder`,
    `- [Glossary](${ORIGIN}/glossary.md): the words the docs use`,
    '',
    '## Reference',
    '',
    ...DOCS.map(doc => `- [${doc.title}](${ORIGIN}/docs/${doc.slug}.md): ${plainText(doc.blurb)}`),
    '',
    '## Optional',
    '',
    `- [Everything in one file](${ORIGIN}/llms-full.txt): every page above, concatenated`,
    `- [The source (the spec)](${GITHUB}): \`src/format/\` holds the schemas and the validator`,
    '',
  ].join('\n');
  writeFileSync(join(out, 'llms.txt'), llms);
  const full = everything.map(page => `<!-- ${ORIGIN}${page.md} -->\n\n${page.text.trim()}\n`).join('\n\n---\n\n');
  writeFileSync(join(out, 'llms-full.txt'), `${llms}\n---\n\n${full}`);

  const missing = renderMarkdown(
    `# Not here\n\nNo page at this address. Try [the home page](/), [the reference](/docs/) or, for agents, [llms.txt](/llms.txt).\n`,
    { link: linker('src/site/pages/index.md', 'html', context) },
  );
  writeFileSync(join(out, '404.html'), layout({ title: 'Not found', description: 'No page at this address.', url: '/404', md: '/llms.txt', body: `<article class="prose">${missing.html}</article>`, version }));
  copyFileSync(join(SITE, 'style.css'), join(out, 'style.css'));
  copyFileSync(join(SITE, '_headers'), join(out, '_headers'));
  writeFileSync(join(out, 'version.json'), `${JSON.stringify({ build: sha, format: version.format, package: version.package })}\n`);

  const stale = /today `([\d.]+)`/.exec(read('docs/SHARDFILE.md'))?.[1];
  const warnings = stale && stale !== version.format ? [`docs/SHARDFILE.md says the format is ${stale}; src/format/version.ts says ${version.format}`] : [];
  return { out, version, dropped: context.dropped, warnings };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const { values } = parseArgs({ options: { out: { type: 'string', default: join(SITE, 'dist') } } });
  const result = await build({ out: values.out ?? join(SITE, 'dist') });
  for (const warning of result.warnings) process.stderr.write(`site: warning: ${warning}\n`);
  process.stdout.write(
    `site: built format ${result.version.format} at ${result.version.sha.slice(0, 12)} into ${result.out} (${result.dropped.length} links to files outside this repo kept as text)\n`,
  );
}
