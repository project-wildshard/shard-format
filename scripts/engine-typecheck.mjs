#!/usr/bin/env node
// Engine's typecheck against this format, before a format push (meta QA 11-25 row 38, J505).
//
// QA 11-24 row 70 made the grass cards optional here (bf0a72b2) and engine main stopped typechecking against format
// main; nobody saw it until the next engine format pin. This runs in `pnpm check` (the push gate's lane):
//   1. fetch engine's origin/main and extract it (git archive, without public/, project/ and docs/) into
//      <canonical format checkout>/tmp/engine-typecheck/<sha>-<pid>, never inside the pushed tree;
//   2. `pnpm install --frozen-lockfile --prefer-offline --ignore-scripts` there (about 3 s from the store);
//   3. link node_modules/@wildshard/format to this format (the pushed tree, J475);
//   4. engine's own `pnpm run typecheck` (about 15 s); then the copy is removed, green or red.
// A red refuses the push: fix engine to typecheck against both formats, land it, then push this.
// Skips (with a line): CI (no engine checkout there; the push gate ran it) and a machine with no engine checkout.
// Engine is found at WS_ENGINE_DIR, else beside the canonical format checkout (../engine).
// Escape hatch (J381): SKIP_ENGINE_TYPECHECK=1, named in the commit body and the receipt.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Engine's trees the typecheck never reads: the big asset and history folders. */
export const EXCLUDED = ['public', 'project', 'docs'];

/** The environment without a hook's GIT_* variables. @param {NodeJS.ProcessEnv} [env] */
export function cleanEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
}

/** @param {string} cwd @param {string[]} args */
function git(cwd, args) {
  return execFileSync('git', args, { cwd, env: cleanEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** The canonical format checkout: a gate copy or a plan worktree shares its git common dir. @param {string} formatDir */
export function canonicalRoot(formatDir) {
  return dirname(git(formatDir, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
}

/** Where engine's checkout is. @param {string} formatDir @param {NodeJS.ProcessEnv} [env] */
export function findEngine(formatDir, env = process.env) {
  if (env.WS_ENGINE_DIR) return resolve(env.WS_ENGINE_DIR);
  return join(dirname(canonicalRoot(formatDir)), 'engine');
}

/** Run a command, capturing its output. @param {string} cmd @param {string[]} args @param {string} cwd */
function run(cmd, args, cwd) {
  const child = spawnSync(cmd, args, { cwd, env: cleanEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 << 20 });
  return { code: child.status ?? 1, output: `${child.stdout ?? ''}${child.stderr ?? ''}`.trim() };
}

/**
 * Typecheck engine at `ref` against the format in `formatDir`.
 * @param {{ formatDir: string, engine: string, scratch: string, ref?: string, fetch?: boolean, say?: (line: string) => void }} options
 * @returns {{ ok: boolean, sha: string, output: string, seconds: number }}
 */
export function engineTypecheck({ formatDir, engine, scratch, ref = 'origin/main', fetch = true, say = () => {} }) {
  const began = performance.now();
  if (fetch) {
    const fetched = run('git', ['fetch', '--quiet', 'origin', 'main'], engine);
    if (fetched.code !== 0) say(`  !! engine fetch failed, checking the last fetched ${ref}: ${fetched.output.split('\n')[0]}`);
  }
  const sha = git(engine, ['rev-parse', '--verify', `${ref}^{commit}`]);
  const dest = join(scratch, `${sha.slice(0, 10)}-${process.pid}`);
  const remove = () => {
    if (!existsSync(dest)) return;
    const trash = `${dest}.trash`;
    try {
      renameSync(dest, trash);
      spawn('rm', ['-rf', trash], { detached: true, stdio: 'ignore' }).unref();
    } catch {
      rmSync(dest, { recursive: true, force: true });
    }
  };
  remove();
  mkdirSync(dest, { recursive: true });
  try {
    const excludes = EXCLUDED.map((path) => `:(exclude)${path}`);
    const extracted = spawnSync('bash', ['-c', 'set -o pipefail; e="$1" s="$2" d="$3"; shift 3; git -C "$e" archive "$s" -- . "$@" | tar -x -C "$d"', 'bash', engine, sha, dest, ...excludes], { env: cleanEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (extracted.status !== 0) return { ok: false, sha, output: `extracting engine ${sha.slice(0, 10)} failed: ${extracted.stderr}`, seconds: 0 };
    const installed = run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts'], dest);
    if (installed.code !== 0) return { ok: false, sha, output: `pnpm install in the engine copy failed:\n${installed.output}`, seconds: 0 };
    const link = join(dest, 'node_modules/@wildshard/format');
    rmSync(link, { force: true });
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(formatDir, link);
    const checked = run('pnpm', ['run', '--silent', 'typecheck'], dest);
    return { ok: checked.code === 0, sha, output: checked.output, seconds: (performance.now() - began) / 1000 };
  } finally {
    remove();
  }
}

/** The CLI, for `pnpm check`. @param {NodeJS.ProcessEnv} env @returns {number} exit code */
export function main(env = process.env) {
  const say = (/** @type {string} */ line) => process.stderr.write(`${line}\n`);
  if (env.CI || env.GITHUB_ACTIONS) {
    say('  - engine typecheck: skipped on CI (no engine checkout; the push gate ran it)');
    return 0;
  }
  if (env.SKIP_ENGINE_TYPECHECK === '1') {
    say('  - engine typecheck: SKIP_ENGINE_TYPECHECK=1 (J381): name it in the commit body and the receipt');
    return 0;
  }
  const formatDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const engine = findEngine(formatDir, env);
  if (!existsSync(join(engine, '.git'))) {
    say(`  - engine typecheck: skipped, no engine checkout at ${engine} (WS_ENGINE_DIR names one)`);
    return 0;
  }
  const scratch = join(canonicalRoot(formatDir), 'tmp/engine-typecheck');
  const result = engineTypecheck({ formatDir, engine, scratch, say });
  if (result.ok) {
    say(`  - engine typecheck: engine ${result.sha.slice(0, 10)} typechecks against this format in ${result.seconds.toFixed(1)} s`);
    return 0;
  }
  say(`\n  X engine main (${result.sha.slice(0, 10)}) does not typecheck against this format:\n`);
  say(result.output.split('\n').slice(0, 40).map((line) => `    ${line}`).join('\n'));
  say('\n  A format change that breaks engine is refused (meta QA 11-25 row 38). Fix engine to typecheck against both its');
  say('  pinned format and this one, land it, then push. Escape hatch (J381): SKIP_ENGINE_TYPECHECK=1, named in the commit body.\n');
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
