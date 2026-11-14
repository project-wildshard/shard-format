/* oxlint-disable node/no-sync, eslint/no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion, eslint/no-console, eslint/curly, unicorn/import-style, eslint/max-statements, eslint/sort-vars, eslint/id-length, eslint/prefer-destructuring, unicorn/no-process-exit, typescript/no-unnecessary-type-parameters -- Author-side settle driver: writes source GLBs and corpus blobs, never shipped or imported. */
// Brasscap Mesa's subjects into the corpus (LF2-8 in meta TEMPLATE-E2E-PLAN).
// Runs the three subject generators (the held lever-action, the tin bandit,
// the Dust Wyrm) into corpus/sources/brasscap-mesa/, then swaps their blobs
// in corpus/brasscap-mesa/: each changed GLB and skin file goes in under its
// new hash and the old one out, with its `files` row (measured by the
// format's own cost parser), its `admission.library` entry and the section
// rows that name it (the lever's `view.asset`, the skin looks' `skin`). The
// library budget moves by the swapped rows' change only: it also carries the
// client scripts' memory and views. Then `shardfile pack` settles the rest,
// and its shard.json, validation.json and canonical sections are copied back.
// All of it runs on a staged copy and is published only once pack succeeds
// (Codex MUST). rebake.ts refuses a changed library blob; this is that hand
// settle, in code.
//   node src/tools/brasscap/subjects.ts
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

import { assetCost } from '../../format/shardfile-assets.ts'
import { buildBandit, buildBanditSkin } from './bandit.ts'
import { buildRifle } from './rifle.ts'
import { buildWyrm, buildWyrmSkin } from './wyrm.ts'

const REPO = resolve(import.meta.dirname, '../../..'),
  CORPUS = join(REPO, 'corpus/brasscap-mesa'),
  SOURCES = join(REPO, 'corpus/sources/brasscap-mesa'),
  WORK = join(REPO, 'tmp/brasscap-subjects'),
  STAGE = join(WORK, 'stage')

interface FileRow {
  compressed: number
  critical: boolean
  decoded: number
  dependencies: string[]
  draws: number
  gpu: number
  hash: string
  kind: string
  path: string
  triangles: number
}
interface Index {
  admission: {
    library: string[]
    budgets: { library: { compressed: number; resident: number } }
  }
  files: FileRow[]
  packs: { entries: { hash: string }[] }[]
}

const sha = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex')
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T

rmSync(WORK, { recursive: true, force: true })
cpSync(CORPUS, STAGE, { recursive: true })
const index = readJson<Index>(join(STAGE, 'shard.json')),
  library = new Set(index.admission.library),
  swaps: [string, string][] = [],
  delta = { compressed: 0, resident: 0 },
  removed: string[] = []

function row(kind: 'glb' | 'json', bytes: Buffer, deps: string[]): FileRow {
  const hash = sha(bytes),
    cost = assetCost(kind, bytes)
  return {
    compressed: bytes.length,
    critical: false,
    decoded: cost.decoded,
    dependencies: deps,
    draws: cost.draws,
    gpu: cost.gpu,
    hash,
    kind,
    path: `blobs/${kind}/${hash}.${kind}`,
    triangles: cost.triangles,
  }
}

/** One library blob out, its successor in. Pack re-measures what this cannot (a skin file's decoded size). */
function swap(oldHash: string, next: FileRow, bytes: Buffer): void {
  if (oldHash === next.hash) return
  const at = index.files.findIndex((file): boolean => file.hash === oldHash),
    old = index.files[at]
  if (old === undefined || !library.has(oldHash))
    throw new Error(`${oldHash} is not a library blob of the corpus`)
  if (old.kind === 'json')
    next.decoded = old.decoded - old.compressed + next.compressed
  index.files[at] = next
  delta.compressed += next.compressed - old.compressed
  delta.resident += next.decoded + next.gpu - old.decoded - old.gpu
  library.delete(oldHash)
  library.add(next.hash)
  if (
    index.packs.some((pack): boolean =>
      pack.entries.some((entry): boolean => entry.hash === oldHash),
    )
  )
    throw new Error(`${oldHash} is a pack member: settle its pack by hand`)
  writeFileSync(join(STAGE, next.path), bytes)
  rmSync(join(STAGE, old.path))
  removed.push(old.path)
  swaps.push([oldHash, next.hash])
}

function writeSource(name: string, bytes: Buffer): Buffer {
  writeFileSync(join(SOURCES, name), bytes)
  return bytes
}

const looks = readJson<{
    rows: { looks: { id: string; parameters: { skin?: string } }[] }
  }>(join(STAGE, 'sections/look/materials.json')).rows.looks,
  items = readJson<{
    items: { rows: { id: string; view?: { asset?: string } }[] }
  }>(join(STAGE, 'sections/combat/items.json')).items.rows

const rifleOld = items.find(
  (item): boolean => item.id === 'weapon.brasscap-lever',
)?.view?.asset
if (rifleOld === undefined) throw new Error('no lever-action view asset')
const rifle = writeSource('rifle.glb', buildRifle())
swap(rifleOld, row('glb', rifle, []), rifle)

for (const [name, look, glb, skinOf] of [
  ['bandit', 'brasscap.bandit.look', buildBandit, buildBanditSkin],
  ['wyrm', 'brasscap.wyrm.look', buildWyrm, buildWyrmSkin],
] as const) {
  const skinOld = looks.find((entry): boolean => entry.id === look)?.parameters
      .skin,
    glbOld = index.files.find((file): boolean => file.hash === skinOld)
      ?.dependencies[0]
  if (skinOld === undefined || glbOld === undefined)
    throw new Error(`no skin look ${look}`)
  const bytes = writeSource(`${name}.glb`, glb()),
    skin = writeSource(`${name}.skin.json`, skinOf(bytes)),
    glbRow = row('glb', bytes, [])
  swap(glbOld, glbRow, bytes)
  swap(skinOld, row('json', skin, [glbRow.hash]), skin)
}

if (swaps.length === 0) {
  rmSync(WORK, { recursive: true, force: true })
  console.log('subjects: every blob is current')
  process.exit(0)
}
index.admission.library = [...library].toSorted()
index.admission.budgets.library.compressed += delta.compressed
index.admission.budgets.library.resident += delta.resident
index.files.sort((left, right): number => (left.hash < right.hash ? -1 : 1))
writeFileSync(join(STAGE, 'shard.json'), `${JSON.stringify(index)}\n`)
for (const file of readdirSync(join(STAGE, 'sections'), { recursive: true })
  .map(String)
  .filter((path): boolean => path.endsWith('.json'))) {
  const path = join(STAGE, 'sections', file)
  let text = readFileSync(path, 'utf8')
  const before = text
  for (const [from, to] of swaps) text = text.replaceAll(from, to)
  if (text !== before) writeFileSync(path, text)
}
mkdirSync(join(WORK, 'unpacked'), { recursive: true })
const tar = join(WORK, 'brasscap-mesa.tar')
execFileSync(
  process.execPath,
  [join(REPO, 'src/cli/bin.mjs'), 'pack', STAGE, '--out', tar],
  { stdio: 'inherit' },
)
execFileSync('tar', ['-xf', tar, '-C', join(WORK, 'unpacked')])
const unpacked = join(WORK, 'unpacked'),
  root = readdirSync(unpacked).includes('shard.json')
    ? unpacked
    : join(unpacked, readdirSync(unpacked)[0] ?? '')
for (const file of ['shard.json', 'validation.json'])
  copyFileSync(join(root, file), join(STAGE, file))
for (const file of readdirSync(join(root, 'sections'), { recursive: true }))
  if (String(file).endsWith('.json'))
    copyFileSync(
      join(root, 'sections', String(file)),
      join(STAGE, 'sections', String(file)),
    )
// Packed: publish the stage over the corpus, the swapped-out blobs removed.
for (const file of readdirSync(STAGE, { recursive: true }).map(String)) {
  const from = join(STAGE, file)
  if (statSync(from).isFile()) copyFileSync(from, join(CORPUS, file))
}
for (const path of removed) rmSync(join(CORPUS, path))
rmSync(WORK, { recursive: true, force: true })
console.log(
  `subjects: ${swaps.length} blobs swapped, library ${delta.compressed >= 0 ? '+' : ''}${delta.compressed} compressed, ${delta.resident >= 0 ? '+' : ''}${delta.resident} resident; packed and copied back`,
)
