import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import {
  DETAIL_LAYERS_MAX,
  DETAIL_MESH_TRIANGLES_MAX,
  LookDetailsSchema,
  detailFileFaults,
  detailLayerRules,
  detailMeshBytes,
  detailMeshViews,
} from './look-details.ts'
import { ShardfileFieldSchemas } from './shardSchema.ts'

// Meta SHARD-SOURCE AP32a: a detail layer is a card mesh plus a density mask the engine scatters round the camera; its
// three files stay binary (engine G649).

type Fields = Readonly<Record<string, unknown>>

const CELLS = 256
const VERTICES = 8
const TRIANGLES = 4
const MESH = 'a'.repeat(64)
const MASK = 'b'.repeat(64)
const HEIGHTS = 'c'.repeat(64)

function bytesOf(
  values: Readonly<Float32Array> | Readonly<Uint16Array>,
): Uint8Array {
  return Uint8Array.from(
    new Uint8Array(values.buffer, values.byteOffset, values.byteLength),
  )
}
function joined(parts: readonly Readonly<Uint8Array>[]): Uint8Array {
  const out = new Uint8Array(
    parts.reduce(
      (total: number, part: Readonly<Uint8Array>): number =>
        total + part.length,
      0,
    ),
  )
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

// A crossed card: two quads, 8 vertices, 4 triangles.
const positions = Float32Array.from([
  -0.2, 0, 0, 0.2, 0, 0, 0.2, 0.3, 0, -0.2, 0.3, 0, 0, 0, -0.2, 0, 0, 0.2, 0,
  0.3, 0.2, 0, 0.3, -0.2,
])
const normals = Float32Array.from(
  { length: VERTICES * 3 },
  (_unused: unknown, index: number): number => (index % 3 === 1 ? 1 : 0),
)
const uvs = Float32Array.from([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1])
const indices = Uint16Array.from([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7])
const meshFile = joined([
  bytesOf(positions),
  bytesOf(normals),
  bytesOf(uvs),
  bytesOf(indices),
])
const files = {
  heights: new Uint8Array(CELLS * 2),
  mask: new Uint8Array(CELLS).fill(128),
  mesh: meshFile,
}
const region = {
  cell: 1,
  columns: 16,
  corner: [-8, -8],
  rows: 16,
  span: [0, 2],
}

function layer(extra: Fields = {}): Record<string, unknown> {
  return {
    clumps: 6,
    heights: HEIGHTS,
    id: 'grass',
    mask: MASK,
    material: 'grass-card',
    mesh: { file: MESH, triangles: TRIANGLES, vertices: VERTICES },
    radius: 40,
    region,
    scale: [0.5, 1.1],
    shadow: false,
    sway: { amount: 0.3, rate: 0.8 },
    tilt: 0.2,
    tint: [
      [0.82, 0.82, 0.62],
      [1, 1, 0.85],
    ],
    ...extra,
  }
}
const nothing: unknown = JSON.parse('null')
function look(extra: Fields = {}): Record<string, unknown> {
  return {
    clock: 'engine',
    dayOverride: nothing,
    families: ['pbr'],
    grade: { contrast: 1, exposure: 0, lut: nothing, saturation: 1 },
    keys: [],
    ...extra,
  }
}
function accepts(rows: readonly unknown[]): boolean {
  return safeParse(LookDetailsSchema, rows).success
}
function acceptsOne(extra: Fields): boolean {
  return accepts([layer(extra)])
}
function numbered(index: number): Record<string, unknown> {
  return layer({ id: `layer${String(index)}` })
}
function binary(hash: string): {
  dependencies: string[]
  hash: string
  kind: string
} {
  return { dependencies: [], hash, kind: 'binary' }
}

test('a look without details parses with no details key (old files keep their bytes)', (): void => {
  const parsed = parse(ShardfileFieldSchemas.look, look())
  expect('details' in parsed).toBe(false)
})

test('a crossed-card grass layer parses inside a look, as written', (): void => {
  const parsed = parse(ShardfileFieldSchemas.look, look({ details: [layer()] }))
  expect(parsed.details?.[0]).toEqual(layer())
  const still = layer()
  delete still['sway']
  expect(parse(LookDetailsSchema, [still, numbered(1)])).toHaveLength(2)
})

test('the mesh file reads back as the card it was written from', (): void => {
  const mesh = { file: MESH, triangles: TRIANGLES, vertices: VERTICES }
  expect(meshFile).toHaveLength(detailMeshBytes(VERTICES, TRIANGLES))
  const views = detailMeshViews(meshFile, mesh)
  expect([...views.positions]).toEqual([...positions])
  expect([...views.uvs]).toEqual([...uvs])
  expect([...views.indices]).toEqual([...indices])
  expect(detailFileFaults({ id: 'grass', mesh, region }, files)).toEqual([])
})

test('files that do not fit the counts or the region are faults', (): void => {
  const mesh = { file: MESH, triangles: TRIANGLES, vertices: VERTICES }
  const short = { ...files, mask: new Uint8Array(CELLS - 1) }
  expect(detailFileFaults({ id: 'grass', mesh, region }, short)).toEqual([
    'detail grass: mask holds 255 bytes, the region has 256 cells',
  ])
  expect(
    detailFileFaults(
      { id: 'grass', mesh, region },
      {
        ...files,
        heights: new Uint8Array(CELLS),
      },
    ),
  ).toHaveLength(1)
  expect(
    detailFileFaults(
      { id: 'grass', mesh: { ...mesh, vertices: 7 }, region },
      files,
    )[0],
  ).toMatch(/mesh file holds/u)
  const pastIndex = joined([
    meshFile.subarray(0, -2),
    bytesOf(Uint16Array.from([9])),
  ])
  expect(
    detailFileFaults(
      { id: 'grass', mesh, region },
      { ...files, mesh: pastIndex },
    ),
  ).toEqual(['detail grass: an index past the last vertex'])
})

test('ranges, caps, ids and unknown keys are checked by the schema', (): void => {
  const many = Array.from(
    { length: DETAIL_LAYERS_MAX + 1 },
    (_unused: unknown, index: number): unknown => numbered(index),
  )
  expect(acceptsOne({ region: { ...region, columns: 513 } })).toBe(false)
  expect(acceptsOne({ region: { ...region, cell: 0.1 } })).toBe(false)
  expect(acceptsOne({ region: { ...region, span: [2, 0] } })).toBe(false)
  expect(
    acceptsOne({
      mesh: {
        file: MESH,
        triangles: DETAIL_MESH_TRIANGLES_MAX + 1,
        vertices: VERTICES,
      },
    }),
  ).toBe(false)
  expect(acceptsOne({ mask: 'not-a-hash' })).toBe(false)
  expect(accepts([layer(), layer()])).toBe(false)
  expect(accepts(many)).toBe(false)
  expect(acceptsOne({ wind: 1 })).toBe(false)
  expect(acceptsOne({ clumps: 0 })).toBe(false)
})

test('the shardfile rule wants declared materials and plain binary files', (): void => {
  const rows = parse(LookDetailsSchema, [
    layer(),
    layer({ id: 'ferns', material: 'frond' }),
  ])
  const declared = [binary(MESH), binary(MASK), binary(HEIGHTS)]
  expect(
    detailLayerRules(rows, { frond: {}, 'grass-card': {} }, declared),
  ).toEqual([])
  expect(detailLayerRules(rows, { 'grass-card': {} }, declared)).toEqual([
    'declared detail layer material',
  ])
  const glb = [binary(MESH), binary(MASK), { ...binary(HEIGHTS), kind: 'glb' }]
  expect(detailLayerRules(rows, { frond: {}, 'grass-card': {} }, glb)).toEqual([
    'detail layer files are declared binaries with no dependencies',
  ])
  expect(detailLayerRules(undefined, {}, [])).toEqual([])
})
