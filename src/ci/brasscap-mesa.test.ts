import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
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
import { buildCanyon } from '../tools/brasscap/canyon.ts'

// BM-2 (meta TEMPLATE-E2E-PLAN): Brasscap Mesa is Template 2's own product, a
// sibling of Template 1's folder: BM-1's canyon baked once into tiles,
// collision and the far mesh, under a sunset. Raw data only, no shared bytes.

const BRASSCAP = path.join(ROOT, 'corpus/brasscap-mesa')
const CODE = /\.(?:ts|tsx|js|mjs|cjs|py)$/u
const BLOB = /^blobs\/[a-z\d]+\/(?<hash>[\da-f]{64})\.[a-z\d]+$/u
const MAX_SUN_DEGREES = 15
const GLB_JSON_AT = 20
const GLB_JSON_LENGTH_AT = 12
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
const Translation = optional(array(Num))
const GlbNode = object({ name: string(), translation: Translation })
const GlbSchema = object({ nodes: array(GlbNode) })

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

test('spawn is the canyon GLB spawn empty', (): void => {
  const glb = buildCanyon()
  const length = glb.readUInt32LE(GLB_JSON_LENGTH_AT)
  const scene = parse(
    GlbSchema,
    JSON.parse(
      glb.subarray(GLB_JSON_AT, GLB_JSON_AT + length).toString('utf8'),
    ),
  )
  const mark = scene.nodes.find(
    (node: Readonly<{ name: string }>): boolean => node.name === 'spawn',
  )?.translation
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
