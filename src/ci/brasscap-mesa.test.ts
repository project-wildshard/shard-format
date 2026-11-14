import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import {
  array,
  number,
  object,
  optional,
  parse,
  record,
  string,
  unknown,
} from 'valibot'

import { ROOT, TEMPLATE_2, cli, scratch } from '../test/helpers/corpus.ts'
import { listFiles, treeHash } from '../tools/brasscap-export.ts'

// BM-2 (meta TEMPLATE-E2E-PLAN): Brasscap Mesa is Template 2's own product, a
// sibling of Template 1's folder: BM-1's canyon baked once into tiles,
// collision and the far mesh, under a sunset. Raw data only, no shared bytes.
// SS4 (meta SHARD-SOURCE-PLAN, J342): its source lives in shard-brasscap; this
// folder is the export of one pinned commit (src/tools/brasscap-export.ts).

const BRASSCAP = path.join(ROOT, 'corpus/exports/brasscap-mesa')
const PIN = path.join(ROOT, 'corpus/exports/brasscap-mesa.pin.json')
/** The canyon GLB's named empties at the pinned commit (shard-brasscap tools/canyon.ts). */
const MARKS: ReadonlyMap<string, readonly number[]> = new Map([
  ['spawn', [-1.6, 0.35, 2.6]],
  ['rack', [-2.2, 1.12, -0.92]],
  ['target.1', [2.5, 1.55, -9.88]],
  ['target.2', [-3.5, 1.55, -13.88]],
])
const CODE = /\.(?:ts|tsx|js|mjs|cjs|py)$/u
const BLOB = /^blobs\/[a-z\d]+\/(?<hash>[\da-f]{64})\.[a-z\d]+$/u
/** A low afternoon sun: LF2-3 raised it to 16 degrees, so the canyon's faces catch it; TEMPLATES-CLEANROOM B2 set the
 *  cleanroom's 39 (31.7 at the look's hour), ahead-left down the canyon, so the mesas' tops light and their faces shade. */
const MAX_SUN_DEGREES = 45
const L0_TILES = 64

const Num = number()
const Triangles = object({ triangles: Num })
const Far = object({ triangles: Num, draws: Num })
const TilesSchema = object({ tiles: array(Triangles), far: Far })
const Rows = object({ tiles: array(unknown()) })
const CollisionSchema = object({ meshCollision: Rows })
const Point = record(string(), Num)
const SpawnSchema = object({ spawn: Point })
const Day = object({ maxElevation: Num })
const Sun = object({ colour: array(Num) })
const Key = object({ sun: Sun })
const Look = object({ day: Day, keys: array(Key) })
const LookSchema = object({ look: Look })
const Light = object({ damage: Num })
const View = object({ asset: optional(string()) })
const ItemRow = object({
  id: string(),
  family: string(),
  view: View,
  light: Light,
})
const ItemsSchema = object({ items: object({ rows: array(ItemRow) }) })
const Interaction = object({ at: array(Num), scene: string() })
const ItemAction = object({ scene: string(), item: string(), action: Num })
const Targets = object({
  interactions: array(Interaction),
  itemActions: array(ItemAction),
})
const UiSchema = object({ targets: Targets })
const Spawn = object({
  id: string(),
  species: string(),
  variant: string(),
  at: array(Num),
})
const CreaturesSchema = object({ creatures: object({ spawns: array(Spawn) }) })
const Variant = object({ id: string(), hp: Num })
const Species = object({ id: string(), variants: array(Variant) })
const SpeciesSchema = object({ rows: object({ species: array(Species) }) })
const Admission = object({ library: array(string()) })
const IndexSchema = object({ admission: Admission })
const POST_REACH = 1
/** `targets.itemActions` action 3 takes a kit.lever into hand (4 reloads it). */
const TAKE = 3

function files(dir: string): readonly string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
}

function section(file: string): unknown {
  return JSON.parse(readFileSync(path.join(BRASSCAP, file), 'utf8'))
}

function blobHashes(dir: string): ReadonlySet<string> {
  return new Set(
    files(dir).flatMap((file: string): readonly string[] => {
      const hash = BLOB.exec(file.replaceAll(path.sep, '/'))?.groups?.['hash']
      return hash === undefined ? [] : [hash]
    }),
  )
}

test('the folder is data, and validates and packs on its own', (): void => {
  assert.deepEqual(
    files(BRASSCAP).filter((file: string): boolean => CODE.test(file)),
    [],
  )
  const checked = cli(['validate', BRASSCAP])
  assert.equal(checked.status, 0, checked.stderr)
  assert.match(checked.stdout, /^ok brasscap-mesa r1:/mu)
  const out = path.join(scratch('brasscap-mesa'), 'brasscap-mesa.tar')
  const packed = cli(['pack', BRASSCAP, '--out', out])
  assert.equal(packed.status, 0, packed.stderr)
  assert.equal(cli(['validate', out]).status, 0)
})

test('it shares no baked bytes with Template 1', (): void => {
  const mine = blobHashes(BRASSCAP)
  const shared = [...blobHashes(TEMPLATE_2)].filter((hash: string): boolean =>
    mine.has(hash),
  )
  assert.ok(mine.size > 0)
  assert.deepEqual(shared, [])
})

test('the canyon is baked: tiles, collision and one far mesh', (): void => {
  const { tiles, far } = parse(
    TilesSchema,
    section('sections/world/tiles.json'),
  )
  const { meshCollision } = parse(
    CollisionSchema,
    section('sections/world/collision.json'),
  )
  const drawn = tiles.filter(
    (row: Readonly<{ triangles: number }>): boolean => row.triangles > 0,
  )
  assert.ok(drawn.length >= L0_TILES, `${drawn.length} drawn tiles`)
  assert.equal(meshCollision.tiles.length, L0_TILES)
  assert.equal(far.draws, 1)
  assert.ok(far.triangles > 0)
})

type Mark = readonly number[] | undefined
type Lever = Readonly<{ id: string; asset: string | undefined; damage: number }>
type Body = Readonly<{
  species: string
  variant: string
  at: readonly number[]
}>

function leverRow(): Lever {
  const { items } = parse(ItemsSchema, section('sections/combat/items.json'))
  const row = items.rows.find(
    (item: Readonly<{ family: string }>): boolean =>
      item.family === 'kit.lever',
  )
  assert.ok(row, 'a kit.lever row')
  return { id: row.id, asset: row.view.asset, damage: row.light.damage }
}

/** Where the rack's prompt that takes `item` stands. */
function takeAt(item: string): Mark {
  const { targets } = parse(UiSchema, section('sections/ui/ui.json'))
  const take = targets.itemActions.find(
    (row: Readonly<{ item: string; action: number }>): boolean =>
      row.item === item && row.action === TAKE,
  )
  return targets.interactions.find(
    (row: Readonly<{ scene: string }>): boolean => row.scene === take?.scene,
  )?.at
}

/** The hit points of the body standing within reach of `mark`. */
function postHp(mark: Mark): number | undefined {
  const [mx = 0, , mz = 0] = mark ?? []
  const { creatures } = parse(
    CreaturesSchema,
    section('sections/actors/creatures.json'),
  )
  const { rows } = parse(SpeciesSchema, section('sections/actors/species.json'))
  const near = (row: Body): boolean =>
    Math.hypot((row.at[0] ?? 0) - mx, (row.at[2] ?? 0) - mz) <= POST_REACH
  const body = creatures.spawns.find(near)
  const species = rows.species.find(
    (row: Readonly<{ id: string }>): boolean => row.id === body?.species,
  )
  return species?.variants.find(
    (row: Readonly<{ id: string }>): boolean => row.id === body?.variant,
  )?.hp
}

// BM-3: the lever-action from rows. The rifle GLB is admitted to the render
// library, the rack's prompt sits on the canyon's rack empty and takes it,
// and each target post holds a body one round downs.
test('BM-3: the lever-action is admitted and its rack takes it', (): void => {
  const lever = leverRow()
  const hash = lever.asset ?? ''
  const glb = path.join(BRASSCAP, `blobs/glb/${hash}.glb`)
  assert.ok(existsSync(glb), 'the held model ships')
  assert.equal(
    createHash('sha256').update(readFileSync(glb)).digest('hex'),
    hash,
  )
  const { admission } = parse(IndexSchema, section('shard.json'))
  assert.ok(admission.library.includes(hash), 'in the render library')
  assert.deepEqual(takeAt(lever.id), MARKS.get('rack'))
})

test('BM-3: each target post holds a body one round downs', (): void => {
  const { damage } = leverRow()
  for (const name of ['target.1', 'target.2']) {
    const hp = postHp(MARKS.get(name))
    assert.ok(hp !== undefined && hp <= damage, `${name} falls to one round`)
  }
})

test('spawn is the canyon GLB spawn empty', (): void => {
  const mark = MARKS.get('spawn')
  const { spawn } = parse(SpawnSchema, section('sections/world/spawn.json'))
  const axes = ['x', 'y', 'z'].map(
    (axis: string): number | undefined => spawn[axis],
  )
  assert.deepEqual(axes, mark)
})

test('the look is a sunset: a low, warm sun', (): void => {
  const { look } = parse(LookSchema, section('sections/look/look.json'))
  assert.ok(look.day.maxElevation <= MAX_SUN_DEGREES)
  const [red = 0, , blue = 1] = look.keys[0]?.sun.colour ?? []
  assert.ok(red > blue, 'a warm sunset sun')
})

test('SS4: the folder is the pinned export, byte for byte', (): void => {
  const pin = parse(
    object({ commit: string(), files: Num, tree: string() }),
    JSON.parse(readFileSync(PIN, 'utf8')),
  )
  assert.match(pin.commit, /^[\da-f]{40}$/u)
  assert.equal(listFiles(BRASSCAP).length, pin.files)
  assert.equal(
    treeHash(BRASSCAP),
    pin.tree,
    'corpus/exports/brasscap-mesa was edited by hand: re-run node src/tools/brasscap-export.ts',
  )
})

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const
const Manifest = record(string(), unknown())
const Dependencies = optional(record(string(), string()), {})

/** The `three` entries in one package.json, by dependency field. */
function threeIn(manifest: string): readonly string[] {
  const text = readFileSync(path.join(ROOT, manifest), 'utf8')
  const json = parse(Manifest, JSON.parse(text))
  return DEPENDENCY_FIELDS.filter(
    (field: string): boolean =>
      parse(Dependencies, json[field])['three'] !== undefined,
  )
}

test('SS4: three is in no shard-format package.json', (): void => {
  const packages = readdirSync(path.join(ROOT, 'packages')).map(
    (name: string): string => `packages/${name}/package.json`,
  )
  const manifests = ['package.json', ...packages].filter(
    (file: string): boolean => existsSync(path.join(ROOT, file)),
  )
  assert.ok(manifests.length > 1)
  for (const manifest of manifests) {
    assert.deepEqual(threeIn(manifest), [], manifest)
  }
})
