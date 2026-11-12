/* oxlint-disable node/no-sync, eslint/no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return, eslint/no-console, eslint/curly, unicorn/no-process-exit, unicorn/import-style, unicorn/max-nested-calls, oxc/no-map-spread -- Author-side bake driver: shells out to a sibling sharddev checkout, never shipped or imported. */
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
// --write copies the cooked files only and prints the manual steps that settle
// shard.json (files, admission lists, budget, pack), as BM-4 ran them. Nothing is written to sharddev's
// tracked files; the work folder is removed unless --keep.
//   node src/tools/brasscap/rebake.ts [--check | --write] [--sharddev <path>] [--keep]
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
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
json('look.json', section('look/look.json')['look'])
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
  glb: 'canyon.glb', materials: { Mesa: 'mesa', Glow: 'glow' }, colliders: 'mesh', far: 'far.', farMode: 'replace',
  interactive: [{ node: 'gate.door', id: 'brasscap.gate', colliderId: 'brasscap.gate' }],
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
let same = 0
const differ: string[] = []
for (const file of files) {
  const built = readFileSync(join(out, file))
  const target = join(CORPUS, file)
  const equal = existsSync(target) && built.equals(readFileSync(target))
  if (equal) same += 1
  else differ.push(file)
  if (write && !equal) {
    mkdirSync(resolve(target, '..'), { recursive: true })
    writeFileSync(target, built)
  }
}
for (const file of differ) console.log(`${write ? 'wrote' : 'DIFFERS'} ${file}`)
console.log(
  `brasscap re-bake: ${same} of ${files.length} files byte-equal (${COOKED.length} sections, ${files.length - COOKED.length} blobs)`,
)
if (!keep) rmSync(work, { recursive: true, force: true })
if (write && differ.length > 0)
  console.log(
    [
      'Copied the sections and blobs only; shard.json is not settled (BM-4 journal):',
      '  1. swap the changed blob hashes in shard.json files and admission lists, drop blobs no section names;',
      '  2. take the cooked sim budget from the work folder (run with --keep);',
      "  3. node src/cli/bin.mjs pack corpus/brasscap-mesa, then copy the tarball's shard.json, validation.json and sections back.",
    ].join('\n'),
  )
if (!write && differ.length > 0) process.exit(1)
