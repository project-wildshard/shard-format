/* oxlint-disable node/no-sync, eslint/no-magic-numbers, eslint/curly, eslint/max-lines-per-function, eslint/max-statements, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types -- Author-side export driver run by hand, like the old rebake.ts: synchronous and one pass; the format never imports it (only the export test reads its tree hash). */
// SS4 (meta SHARD-SOURCE-PLAN, J342): the Brasscap export, run by hand. Brasscap Mesa's source lives in the
// `shard-brasscap` repo; shard-format keeps only the shard file folder that one pinned commit of it builds, in
// corpus/exports/brasscap-mesa/, for its smoke tests and engine's. This script:
//   1. resolves the commit in a local shard-brasscap checkout (3475153 or later, the first commit with the source);
//   2. extracts that commit with `git archive` into tmp/brasscap-export/ (never the checkout's working tree);
//   3. installs its own lockfile there (`pnpm install --frozen-lockfile --ignore-scripts`);
//   4. runs `wildshard build .` there, from the sdk that commit pins;
//   5. replaces corpus/exports/brasscap-mesa/ with the built folder, less every file over the repo's 1 MB blob cap
//      (.githooks/lib.mjs MAX_BYTES), and writes the pin file beside it.
// J506: the pin keeps the whole build's file count and tree hash (engine's test/fixtures/corpus copy names the same
// ones), lists what it left out, and hashes what is kept; tests that need a whole folder read corpus/legacy/.
// No three.js lands in shard-format: three is installed in the scratch folder only, and goes with it. Nothing
// runs in CI; the export test checks the committed folder against the pin's tree hash.
//   node src/tools/brasscap-export.ts [--commit <rev>] [--repo <shard-brasscap checkout>] [--check] [--keep]
// --commit defaults to the pin's commit (a rebuild of what is committed); --check builds and compares, writing
// nothing, and exits 1 on a difference. Two runs on one commit write identical bytes.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SLUG = 'brasscap-mesa'
const EXPORT = path.join(ROOT, 'corpus/exports', SLUG)
const PIN = path.join(ROOT, 'corpus/exports', `${SLUG}.pin.json`)
const REPO_URL = 'https://github.com/project-wildshard/shard-brasscap'
/** The first shard-brasscap commit that holds Brasscap's source (SS3); an export bakes it or a later one. */
const FLOOR = '34751535e1c70f107b2352d911ac900cc08feb55'
/** The repo's blob cap (.githooks/lib.mjs MAX_BYTES): a larger built file stays out of the copy. */
const MAX_BYTES = 1024 * 1024

interface Pin {
  readonly about: string
  readonly repo: string
  readonly commit: string
  readonly folder: string
  readonly files: number
  readonly tree: string
  readonly omitted: {
    readonly maxBytes: number
    readonly files: readonly string[]
  }
  readonly kept: { readonly files: number; readonly tree: string }
}

/** Every regular file under `folder`, as sorted `/`-joined relative paths. */
function listFiles(folder: string): readonly string[] {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry): boolean => entry.isFile())
    .map((entry): string =>
      path
        .relative(folder, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join('/'),
    )
    .toSorted()
}

/** One hash for a whole folder (or the listed files of it): sha256 over each file's `path NUL sha256 LF`, in path order. */
function treeHash(
  folder: string,
  files: readonly string[] = listFiles(folder),
): string {
  const tree = createHash('sha256')
  for (const file of files) {
    const bytes = readFileSync(path.join(folder, file))
    tree.update(
      `${file}\0${createHash('sha256').update(bytes).digest('hex')}\n`,
    )
  }
  return tree.digest('hex')
}

/** The build's files, those over the blob cap, and the rest (the copy). */
function split(built: string): {
  all: readonly string[]
  big: readonly string[]
  kept: readonly string[]
} {
  const all = listFiles(built)
  const big = all.filter(
    (file: string): boolean =>
      statSync(path.join(built, file)).size > MAX_BYTES,
  )
  const kept = all.filter((file: string): boolean => !big.includes(file))
  return { all, big, kept }
}

/** --check: is the committed copy what this commit builds? */
function checkExport(pin: Pin, pinned: Pin | undefined): boolean {
  const short = pin.commit.slice(0, 7)
  const same =
    existsSync(EXPORT) &&
    treeHash(EXPORT) === pin.kept.tree &&
    pinned?.tree === pin.tree &&
    pinned.commit === pin.commit
  process.stdout.write(
    same
      ? `ok: corpus/exports/${SLUG} is shard-brasscap ${short} (${pin.files} files, tree ${pin.tree})\n`
      : `stale: shard-brasscap ${short} builds tree ${pin.tree}; committed is ${pinned?.tree ?? 'none'} at ${pinned?.commit.slice(0, 7) ?? 'none'}\n`,
  )
  return same
}

function readPin(): Pin | undefined {
  if (!existsSync(PIN)) return undefined
  return JSON.parse(readFileSync(PIN, 'utf8')) as Pin
}

function run(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
}

function main(): void {
  const args = process.argv.slice(2)
  const flag = (name: string): string | undefined => {
    const at = args.indexOf(name)
    return at === -1 ? undefined : args[at + 1]
  }
  const check = args.includes('--check')
  const keep = args.includes('--keep')
  const repo = path.resolve(ROOT, flag('--repo') ?? '../shard-brasscap')
  const pinned = readPin()
  const rev = flag('--commit') ?? pinned?.commit
  if (rev === undefined)
    throw new Error('no pin yet: pass --commit <shard-brasscap commit>')
  if (!existsSync(path.join(repo, '.git')))
    throw new Error(
      `no shard-brasscap checkout at ${repo} (pass --repo <path>)`,
    )
  const commit = run(
    'git',
    ['rev-parse', '--verify', `${rev}^{commit}`],
    repo,
  ).trim()
  try {
    run('git', ['merge-base', '--is-ancestor', FLOOR, commit], repo)
  } catch {
    throw new Error(
      `${commit} does not contain ${FLOOR.slice(0, 7)} (SS3): pin that commit or a later one`,
    )
  }

  const work = path.join(ROOT, 'tmp/brasscap-export')
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  try {
    const archive = path.join(work, 'source.tar')
    const source = path.join(work, 'source')
    mkdirSync(source)
    run('git', ['archive', '--format=tar', '-o', archive, commit], repo)
    run('tar', ['-xf', archive, '-C', source], work)
    run(
      'pnpm',
      ['install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts'],
      source,
    )
    run('pnpm', ['exec', 'wildshard', 'build', '.'], source)
    const built = path.join(source, 'public/shardfiles', SLUG)
    const index = JSON.parse(
      readFileSync(path.join(built, 'shard.json'), 'utf8'),
    ) as { identity?: { slug?: string } }
    if (index.identity?.slug !== SLUG)
      throw new Error(`the build at ${commit} is not ${SLUG}`)
    const { all, big, kept } = split(built)
    const pin: Pin = {
      about:
        'SS4 (J342, J506): corpus/exports/brasscap-mesa/ is `wildshard build` of this shard-brasscap commit less the files over the 1 MB blob cap (omitted; files and tree are the whole build, kept is the copy), written by node src/tools/brasscap-export.ts. Do not edit it by hand: change shard-brasscap, then re-export.',
      repo: REPO_URL,
      commit,
      folder: `corpus/exports/${SLUG}`,
      files: all.length,
      tree: treeHash(built, all),
      omitted: { maxBytes: MAX_BYTES, files: big },
      kept: { files: kept.length, tree: treeHash(built, kept) },
    }
    const short = commit.slice(0, 7)
    if (check) {
      if (!checkExport(pin, pinned)) process.exitCode = 1
      return
    }
    rmSync(EXPORT, { recursive: true, force: true })
    mkdirSync(path.dirname(EXPORT), { recursive: true })
    for (const file of kept) {
      mkdirSync(path.dirname(path.join(EXPORT, file)), { recursive: true })
      cpSync(path.join(built, file), path.join(EXPORT, file))
    }
    writeFileSync(PIN, `${JSON.stringify(pin, undefined, 2)}\n`)
    process.stdout.write(
      `exported shard-brasscap ${short} to corpus/exports/${SLUG}: ${pin.kept.files} of ${pin.files} files (less ${big.length} over ${MAX_BYTES} bytes), tree ${pin.tree}\n`,
    )
  } finally {
    if (!keep) rmSync(work, { recursive: true, force: true })
  }
}

if (import.meta.main) main()

export { listFiles, treeHash }
