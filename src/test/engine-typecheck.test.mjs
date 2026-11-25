// meta QA 11-25 row 38 (J505): a format change that breaks engine's typecheck is refused before the push.
// A tiny engine (a git repo with an origin, no dependencies) reads a tuple type from a tiny format; the real tsc this
// repo carries checks it. The format turning that tuple into a union is refused; the unchanged format passes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { cleanEnv, engineTypecheck, main } from '../scripts/engine-typecheck.mjs';

const repo = resolve(import.meta.dirname, '../..');
// The lockfile's TypeScript 6 (a devDependency), so a gate copy's fresh install carries it too.
const tsc = join(repo, 'node_modules/@typescript/typescript6/bin/tsc6');
mkdirSync(join(repo, 'tmp'), { recursive: true });
const base = mkdtempSync(join(repo, 'tmp/engine-typecheck-test-'));
after(() => rmSync(base, { recursive: true, force: true }));

/** @param {string} cwd @param {string[]} args */
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...cleanEnv(), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

/** @param {string} dir @param {Record<string, string>} files */
function write(dir, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

/** A format whose grass looks are `looks`. @param {string} name @param {string} looks */
function format(name, looks) {
  const dir = join(base, name);
  write(dir, {
    'package.json': JSON.stringify({ name: '@wildshard/shard-format', version: '0.0.0', type: 'module', exports: { './grass': './grass.ts' } }),
    'grass.ts': `export interface GrassView { looks: ${looks} }\n`,
  });
  return dir;
}

// The engine: its typecheck also fails on a copy holding public/ (never extracted). Its main reads the third look as a string, as engine's grassPresentation did before row 38.
const origin = join(base, 'engine-origin.git');
const engine = join(base, 'engine');
mkdirSync(engine);
git(base, ['init', '--quiet', '--bare', origin]);
git(engine, ['init', '--quiet', '-b', 'main']);
write(engine, {
  'package.json': JSON.stringify({ name: 'engine', private: true, scripts: { typecheck: `test ! -e public && node ${JSON.stringify(tsc)} -p tsconfig.json` } }),
  'pnpm-lock.yaml': "lockfileVersion: '9.0'\n\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\n\nimporters:\n\n  .: {}\n",
  'pnpm-workspace.yaml': 'packages: []\n',
  'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: 'esnext', moduleResolution: 'bundler', allowImportingTsExtensions: true, target: 'es2022', types: [] }, include: ['src'] }),
  'src/grass.ts': "import type { GrassView } from '@wildshard/format/grass';\nexport function clumps(view: GrassView): string { const [, , third] = view.looks; return third; }\n",
  'public/huge.bin': 'never extracted\n',
});
git(engine, ['add', '.']);
git(engine, ['commit', '--quiet', '-m', 'engine']);
git(engine, ['remote', 'add', 'origin', origin]);
git(engine, ['push', '--quiet', 'origin', 'main']);

test('engine typechecks against an unchanged format: the push passes', () => {
  const said = [];
  const result = engineTypecheck({ formatDir: format('same', '[string, string, string]'), engine, scratch: join(base, 'scratch'), say: (line) => said.push(line) });
  assert.equal(result.ok, true, result.output);
  assert.match(result.sha, /^[0-9a-f]{40}$/u);
  assert.deepEqual(said, []);
});

test('a format change that breaks engine is refused, naming the engine error', () => {
  const result = engineTypecheck({ formatDir: format('breaking', '[string, string] | [string, string, string]'), engine, scratch: join(base, 'scratch') });
  assert.equal(result.ok, false);
  assert.match(result.output, /src\/grass\.ts.*TS2322/u);
});

test('the engine copy is removed, green or red', () => {
  const scratch = join(base, 'scratch');
  const left = existsSync(scratch) ? readdirSync(scratch).filter((name) => !name.endsWith('.trash')) : [];
  assert.deepEqual(left, []);
});

test('the CLI skips on CI and on the escape hatch, saying so', () => {
  assert.equal(main({ CI: 'true' }), 0);
  assert.equal(main({ SKIP_ENGINE_TYPECHECK: '1' }), 0);
});
