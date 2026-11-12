/* oxlint-disable node/no-sync, eslint/no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return, eslint/no-console, eslint/curly, unicorn/no-process-exit, unicorn/import-style, unicorn/max-nested-calls, oxc/no-map-spread, eslint/max-statements, eslint/max-lines, eslint/max-lines-per-function -- Author-side bake driver: shells out to a sibling sharddev checkout, never shipped or imported. */
// Brasscap Mesa (Template 2): the one-command author re-bake (LF2-1 in meta
// TEMPLATE-E2E-PLAN). It turns canyon.ts's bake input into the canyon's cooked
// sections in corpus/brasscap-mesa/, through a sibling sharddev checkout, as
// BM-2 and BM-4 ran it by hand (journal 2026-11-11-brasscap-canyon.md):
//   1. `canyon.ts --bake` writes the bake GLB (no sky, sand skirt, welded far);
//   2. a throwaway project in <sharddev>/tmp/brasscap-rebake/ spreads
//      emptyShardfile(identity) with this corpus's look, state, sim and hooks,
//      the gate's behaviour (gate.as) and the GLB's world declaration;
//   3. `wildshard build <project> <out> --product-only` cooks it;
//   4. the cooked world/tiles, world/collision, world/props and sim/sim
//      sections and every blob they name are compared with (--check, the
//      default) or copied into (--write) corpus/brasscap-mesa/.
// --write settles a staged copy of the corpus (LF2-2): the cooked files in,
// the changed blobs' rows, critical entries and pack members, the sim budget,
// then `shardfile pack` and its settled files; only then is the stage copied
// over corpus/brasscap-mesa/. Nothing is written to sharddev's
// tracked files; the work folder is removed unless --keep.
//   node src/tools/brasscap/rebake.ts [--check | --write] [--sharddev <path>] [--keep]
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../../..')
const CORPUS = join(REPO, 'corpus/brasscap-mesa')
const SOURCES = join(REPO, 'corpus/sources/brasscap-mesa')
/** The cooked sections the bake owns; every other section is authored rows. */
const COOKED = [
  'world/tiles.json',
  'world/collision.json',
  'world/props.json',
  'sim/sim.json',
] as const
const HASH = /[0-9a-f]{64}/gu

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const at = args.indexOf(name)
  return at === -1 ? undefined : args[at + 1]
}
const write = args.includes('--write')
const keep = args.includes('--keep')
const sharddev = resolve(REPO, flag('--sharddev') ?? '../sharddev')
if (!existsSync(join(sharddev, 'bin/wildshard.mjs')))
  throw new Error(
    `no sharddev checkout at ${sharddev} (pass --sharddev <path>)`,
  )

const work = join(sharddev, 'tmp/brasscap-rebake')
const project = join(work, 'project')
const out = join(work, 'out')
rmSync(work, { recursive: true, force: true })
mkdirSync(project, { recursive: true })

const section = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(CORPUS, 'sections', path), 'utf8'))
const json = (name: string, value: unknown): void => {
  writeFileSync(join(project, name), JSON.stringify(value))
}

// 1. The bake GLB, from source.
execFileSync(
  process.execPath,
  [
    join(REPO, 'src/tools/brasscap/canyon.ts'),
    '--bake',
    join(project, 'canyon.glb'),
  ],
  { stdio: 'inherit' },
)
copyFileSync(join(SOURCES, 'gate.as'), join(project, 'gate.as'))

// 2. The project: authored rows from the corpus, the gate's module as `script:gate`.
const sim = section('sim/sim.json')['sim'] as {
  scripts: string[]
  bindings: { module: string }[]
}
if (sim.scripts.length !== 1)
  throw new Error(
    `sim has ${sim.scripts.length} scripts; the bake knows only the gate`,
  )
const [gate] = sim.scripts
const authoredSim = {
  ...sim,
  scripts: ['script:gate'],
  bindings: sim.bindings.map((row): { module: string } =>
    row.module === gate ? { ...row, module: 'script:gate' } : row,
  ),
}
json(
  'identity.json',
  (
    JSON.parse(readFileSync(join(CORPUS, 'shard.json'), 'utf8')) as {
      identity: unknown
    }
  ).identity,
)
// The bake cooks no post pass, and sharddev's format can lag this corpus's post ops (LF2-3's `viewRay`), so
// the throwaway project leaves `look.post` out; the cooked world and sim sections never read it (LF2-5).
const { post: _post, ...bakeLook } = section('look/look.json')[
  'look'
] as Record<string, unknown>
json('look.json', bakeLook)
json('state.json', section('state/state.json')['state'])
json('hooks.json', section('sim/hooks.json')['hooks'])
json('sim.json', authoredSim)
writeFileSync(
  join(project, 'shard.config.ts'),
  `import { emptyShardfile } from '@wildshard/sharddev/author';
import identity from './identity.json' with { type: 'json' };
import look from './look.json' with { type: 'json' };
import state from './state.json' with { type: 'json' };
import hooks from './hooks.json' with { type: 'json' };
import sim from './sim.json' with { type: 'json' };

const base = emptyShardfile(identity);
export default { ...base, look, state, sim, hooks, world: {
  glb: 'canyon.glb', materials: { Mesa: 'mesa', Glow: 'glow' }, colliders: 'mesh', far: 'far.', farMode: 'replace', detail: 'dress', coarse: 'coarse.',
  interactive: [
    { node: 'gate.door', id: 'brasscap.gate', colliderId: 'brasscap.gate' },
    { node: 'rack.rifle', id: 'brasscap.rack.rifle', colliderId: 'brasscap.rack.rifle' },
  ],
} };
export const behaviour = [{ id: 'gate', source: 'gate.as' }];
`,
)

// 3. The cook.
execFileSync(
  process.execPath,
  ['bin/wildshard.mjs', 'build', project, out, '--product-only'],
  {
    cwd: sharddev,
    stdio: 'inherit',
  },
)

// The rack's rifle is a drawn-only panel (TE-ENG6): its panel follows the player's projected `taken` field,
// which the server's colliders never read, so the format refuses it a bound collider. sharddev bakes a collider
// for every interactive node; this drops the rifle's, so its blob is never named, copied or admitted.
const DRAWN_ONLY = new Set(['brasscap.rack.rifle'])
{
  const path = join(out, 'sections/world/collision.json')
  const text = readFileSync(path, 'utf8')
  const cooked = JSON.parse(text) as {
    meshCollision: { panels: { panel: string }[] }
  }
  const before = cooked.meshCollision.panels.length
  cooked.meshCollision.panels = cooked.meshCollision.panels.filter(
    (row): boolean => !DRAWN_ONLY.has(row.panel),
  )
  if (before - cooked.meshCollision.panels.length !== DRAWN_ONLY.size)
    throw new Error('the cook baked no collider for a drawn-only panel')
  writeFileSync(
    path,
    `${JSON.stringify(cooked)}${text.endsWith('\n') ? '\n' : ''}`,
  )
}

// 4. Compare or copy: the four sections and every blob they name.
const blobPath = (root: string, hash: string): string | undefined => {
  for (const kind of readdirSync(join(root, 'blobs'))) {
    const hit = readdirSync(join(root, 'blobs', kind)).find((name): boolean =>
      name.startsWith(hash),
    )
    if (hit !== undefined) return join('blobs', kind, hit)
  }
  return undefined
}
const files: string[] = []
for (const path of COOKED) {
  files.push(join('sections', path))
  for (const hash of new Set(
    readFileSync(join(out, 'sections', path), 'utf8').match(HASH),
  )) {
    const blob = blobPath(out, hash)
    if (blob !== undefined) files.push(blob)
  }
}
/** The hashes the cooked sections name, in `root`. */
const named = (root: string): Set<string> =>
  new Set(
    COOKED.flatMap(
      (path): string[] =>
        readFileSync(join(root, 'sections', path), 'utf8').match(HASH) ?? [],
    ),
  )
const before = named(CORPUS)
// --write works on a staged copy of the corpus and publishes it only once the settle and pack pass, so a
// failure leaves corpus/brasscap-mesa/ as it was and a retry sees the same differences (Codex MUST).
const stage = join(work, 'stage')
if (write) cpSync(CORPUS, stage, { recursive: true })
let same = 0
const differ: string[] = []
for (const file of files) {
  const built = readFileSync(join(out, file))
  const target = join(CORPUS, file)
  const equal = existsSync(target) && built.equals(readFileSync(target))
  if (equal) same += 1
  else differ.push(file)
  if (write && !equal) {
    const staged = join(stage, file)
    mkdirSync(resolve(staged, '..'), { recursive: true })
    writeFileSync(staged, built)
  }
}
for (const file of differ) console.log(`${write ? 'wrote' : 'DIFFERS'} ${file}`)
console.log(
  `brasscap re-bake: ${same} of ${files.length} files byte-equal (${COOKED.length} sections, ${files.length - COOKED.length} blobs)`,
)
interface FileRow {
  hash: string
  path: string
  critical: boolean
  compressed: number
  decoded: number
  gpu: number
  dependencies: string[]
}
interface PackRow {
  bytes: number
  entries: { hash: string; bytes: number; offset: number }[]
}
interface Index {
  files: FileRow[]
  packs: PackRow[]
  admission: {
    critical: string[]
    library: string[]
    budgets: {
      library: { compressed: number; resident: number }
      sim: { compressed: number; resident: number }
    }
    serverBudget: { memory: number }
  }
}

/** The critical rows' total `key`: the sim budget counts critical blobs. */
const criticalSum = (rows: FileRow[], key: 'compressed' | 'decoded'): number =>
  rows
    .filter((row): boolean => row.critical)
    .reduce((total, row): number => total + row[key], 0)

/** A render-library blob's cost, as sharddev's cook counts it: decoded plus gpu resident, and compressed. */
const libraryCost = (
  rows: FileRow[],
): { compressed: number; resident: number } => ({
  compressed: rows.reduce((total, row): number => total + row.compressed, 0),
  resident: rows.reduce(
    (total, row): number => total + row.decoded + row.gpu,
    0,
  ),
})

/** A drawn panel's GLB is a render-library blob (the rack's rifle, TE-ENG6; the gate's doors): it joins or
 *  leaves `admission.library`, and the library budget moves by its cost. A panel whose bytes change (LF2-6's
 *  gate doors) is one leaving and one joining, so the budget moves by the difference. One with dependencies
 *  is still settled by hand. */
function settleLibrary({
  index,
  cookedLibrary,
  added,
  goneRows,
}: {
  index: Index
  cookedLibrary: string[]
  added: FileRow[]
  goneRows: FileRow[]
}): void {
  const library = new Set([...index.admission.library, ...cookedLibrary])
  const libraryAdded = added.filter((row): boolean => library.has(row.hash)),
    libraryGone = goneRows.filter((row): boolean => library.has(row.hash))
  if (
    [...libraryAdded, ...libraryGone].some(
      (row): boolean => row.dependencies.length > 0,
    )
  )
    throw new Error(
      'a render-library blob with dependencies changed: settle its budget by hand',
    )
  for (const row of [...libraryGone, ...libraryAdded])
    console.log(
      `library ${libraryGone.includes(row) ? '-' : '+'} ${row.hash.slice(0, 12)} ${row.compressed} compressed, ${row.decoded + row.gpu} resident`,
    )
  const costIn = libraryCost(libraryAdded),
    costOut = libraryCost(libraryGone)
  const gone = new Set(libraryGone.map((row): string => row.hash))
  index.admission.library = [
    ...index.admission.library.filter((hash): boolean => !gone.has(hash)),
    ...libraryAdded.map((row): string => row.hash),
  ].toSorted()
  index.admission.budgets.library.compressed +=
    costIn.compressed - costOut.compressed
  index.admission.budgets.library.resident += costIn.resident - costOut.resident
}

/** Settles shard.json after a --write (LF2-2): the changed blobs' rows swap in `files` and the critical
 *  list, blobs no section names any more are dropped, the sim budget and server memory move by the
 *  critical blobs' change (the budget is their sum, plus fixed headroom), and `shardfile pack` measures
 *  the rest; its shard.json, validation.json and canonical sections are copied back. */
function settle(after: Set<string>): void {
  const cooked = JSON.parse(
      readFileSync(join(out, 'shard.json'), 'utf8'),
    ) as Index,
    indexPath = join(stage, 'shard.json')
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as Index
  const authored = readdirSync(join(stage, 'sections'), {
    recursive: true,
  })
    .map(String)
    .filter(
      (file): boolean =>
        file.endsWith('.json') &&
        !COOKED.some((path): boolean => path === file),
    )
    .map((file): string => readFileSync(join(stage, 'sections', file), 'utf8'))
    .join('\n')
  const gone = new Set(
    [...before].filter(
      (hash): boolean => !after.has(hash) && !authored.includes(hash),
    ),
  )
  const listed = new Set(index.files.map((row): string => row.hash))
  const goneRows = index.files.filter((row): boolean => gone.has(row.hash))
  const added = cooked.files.filter(
    (row): boolean => after.has(row.hash) && !listed.has(row.hash),
  )
  settleLibrary({
    index,
    cookedLibrary: cooked.admission.library,
    added,
    goneRows,
  })
  const compressed =
      criticalSum(added, 'compressed') - criticalSum(goneRows, 'compressed'),
    decoded = criticalSum(added, 'decoded') - criticalSum(goneRows, 'decoded')
  index.files = [
    ...index.files.filter((row): boolean => !gone.has(row.hash)),
    ...added,
  ].toSorted((left, right): number => (left.hash < right.hash ? -1 : 1))
  index.admission.critical = [
    ...index.admission.critical.filter((hash): boolean => !gone.has(hash)),
    ...added
      .filter((row): boolean => row.critical)
      .map((row): string => row.hash),
  ].toSorted()
  // Packs list their members: gone blobs leave every pack, and each new blob joins the pack that shares
  // the most members with the cooked pack holding it, at the cooked size.
  const cookedBytes = new Map(
    cooked.packs.flatMap((pack): [string, number][] =>
      pack.entries.map((entry): [string, number] => [entry.hash, entry.bytes]),
    ),
  )
  for (const pack of index.packs)
    pack.entries = pack.entries.filter(
      (entry): boolean => !gone.has(entry.hash),
    )
  for (const row of added) {
    const home = cooked.packs.find((pack): boolean =>
      pack.entries.some((entry): boolean => entry.hash === row.hash),
    )
    const members = new Set(home?.entries.map((entry): string => entry.hash))
    let most = -1,
      target: PackRow | undefined = undefined
    for (const pack of index.packs) {
      const overlap = pack.entries.filter((entry): boolean =>
        members.has(entry.hash),
      ).length
      if (overlap > most) {
        target = pack
        most = overlap
      }
    }
    if (home === undefined || target === undefined)
      throw new Error(`no cooked pack holds ${row.hash}`)
    target.entries.push({
      hash: row.hash,
      bytes: cookedBytes.get(row.hash) ?? row.compressed,
      offset: 0,
    })
  }
  // Offsets run on from 0 and a pack's size is its members' (format outputIndex I5); pack hashes it.
  for (const pack of index.packs) {
    let end = 0
    for (const entry of pack.entries) {
      entry.offset = end
      end += entry.bytes
    }
    pack.bytes = end
  }
  index.admission.budgets.sim.compressed += compressed
  index.admission.budgets.sim.resident += decoded
  index.admission.serverBudget.memory += decoded
  writeFileSync(indexPath, `${JSON.stringify(index)}\n`)
  for (const row of goneRows) rmSync(join(stage, row.path), { force: true })
  const tar = join(work, 'brasscap-mesa.tar'),
    unpacked = join(work, 'unpacked')
  execFileSync(
    process.execPath,
    [join(REPO, 'src/cli/bin.mjs'), 'pack', stage, '--out', tar],
    { stdio: 'inherit' },
  )
  mkdirSync(unpacked, { recursive: true })
  execFileSync('tar', ['-xf', tar, '-C', unpacked])
  const root = readdirSync(unpacked).includes('shard.json')
    ? unpacked
    : join(unpacked, readdirSync(unpacked)[0] ?? '')
  for (const file of ['shard.json', 'validation.json'])
    copyFileSync(join(root, file), join(stage, file))
  for (const file of readdirSync(join(root, 'sections'), { recursive: true }))
    if (String(file).endsWith('.json'))
      copyFileSync(
        join(root, 'sections', String(file)),
        join(stage, 'sections', String(file)),
      )
  console.log(
    `settled shard.json: ${added.length} blobs in, ${goneRows.length} out, sim budget ${compressed >= 0 ? '+' : ''}${compressed} compressed, ${decoded >= 0 ? '+' : ''}${decoded} resident; packed and copied back`,
  )
}

/** Copies the settled stage over the corpus: changed files in, blobs the stage dropped out. */
function publish(): void {
  for (const file of readdirSync(stage, { recursive: true }).map(String)) {
    const from = join(stage, file),
      to = join(CORPUS, file)
    if (
      !statSync(from).isDirectory() &&
      (!existsSync(to) || !readFileSync(from).equals(readFileSync(to)))
    ) {
      mkdirSync(resolve(to, '..'), { recursive: true })
      copyFileSync(from, to)
    }
  }
  for (const file of readdirSync(join(CORPUS, 'blobs'), {
    recursive: true,
  }).map(String))
    if (!existsSync(join(stage, 'blobs', file)))
      rmSync(join(CORPUS, 'blobs', file), { force: true })
}

if (write && differ.length > 0) {
  settle(named(out))
  publish()
}
if (!keep) rmSync(work, { recursive: true, force: true })
if (!write && differ.length > 0) process.exit(1)
