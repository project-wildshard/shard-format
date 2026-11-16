import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import {
  DETAIL_LAYERS_MAX,
  DETAIL_MESH_TRIANGLES_MAX,
  LookDetailsSchema,
  base64Bytes,
  decodeBase64,
  detailMaterialFaults,
} from './look-details.ts'
import { ShardfileFieldSchemas } from './shardSchema.ts'

// Meta SHARD-SOURCE AP32a: a detail layer is a card mesh plus a density mask the engine scatters round the camera.

type Fields = Readonly<Record<string, unknown>>

const CELLS = 256
const HALF_MASK = 128
const MID_HEIGHT = 32_768
const FLOAT_BYTES = 4
const UV_FLOATS = 2
const XYZ_FLOATS = 3
const TRIANGLE_FLOATS = 9

function encode(bytes: Readonly<Uint8Array>): string {
  return Buffer.from(bytes).toString('base64')
}
function floats(values: readonly number[]): string {
  return encode(new Uint8Array(Float32Array.from(values).buffer))
}
function shorts(values: readonly number[]): string {
  return encode(new Uint8Array(Uint16Array.from(values).buffer))
}
function repeat(values: readonly number[], times: number): number[] {
  return Array.from({ length: times }, (): readonly number[] => values).flat()
}
function zeros(length: number): string {
  return encode(new Uint8Array(length))
}

// A crossed card: two quads, 8 vertices, 4 triangles.
const card = {
  indices: shorts([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]),
  normals: floats(repeat([0, 1, 0], 8)),
  positions: floats([
    -0.2, 0, 0, 0.2, 0, 0, 0.2, 0.3, 0, -0.2, 0.3, 0, 0, 0, -0.2, 0, 0, 0.2, 0,
    0.3, 0.2, 0, 0.3, -0.2,
  ]),
  uvs: floats(repeat([0, 0, 1, 0, 1, 1, 0, 1], 2)),
}
const triangle = {
  normals: floats(repeat([0, 0, 1], 3)),
  positions: floats([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  uvs: floats([0, 0, 1, 0, 0, 1]),
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
    heights: shorts(repeat([MID_HEIGHT], CELLS)),
    id: 'grass',
    mask: encode(new Uint8Array(CELLS).fill(HALF_MASK)),
    material: 'grass-card',
    mesh: card,
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

test('a look without details parses with no details key (old files keep their bytes)', (): void => {
  const parsed = parse(ShardfileFieldSchemas.look, look())
  expect('details' in parsed).toBe(false)
})

test('a crossed-card grass layer parses inside a look, as written', (): void => {
  const parsed = parse(ShardfileFieldSchemas.look, look({ details: [layer()] }))
  expect(parsed.details?.[0]).toEqual(layer())
  expect(base64Bytes(card.positions)).toBe(8 * XYZ_FLOATS * FLOAT_BYTES)
  const still = layer({ mesh: triangle })
  delete still['sway']
  expect(parse(LookDetailsSchema, [still, numbered(1)])).toHaveLength(2)
})

test('base64 decodes exactly, pad or no pad', (): void => {
  const bytes = Uint8Array.from([0, 1, 254, 255, 7])
  expect([...decodeBase64(encode(bytes))]).toEqual([...bytes])
  const short = encode(bytes.subarray(0, 3))
  expect([...decodeBase64(short)]).toEqual([0, 1, 254])
})

test('a mask or heights that do not fit the region are refused', (): void => {
  expect(acceptsOne({ mask: zeros(CELLS - 1) })).toBe(false)
  expect(acceptsOne({ heights: zeros(CELLS) })).toBe(false)
  expect(acceptsOne({ region: { ...region, columns: 513 } })).toBe(false)
  expect(acceptsOne({ region: { ...region, cell: 0.1 } })).toBe(false)
  expect(acceptsOne({ region: { ...region, span: [2, 0] } })).toBe(false)
})

test('a card mesh over the triangle cap, a bad index or mismatched attributes is refused', (): void => {
  const many = (DETAIL_MESH_TRIANGLES_MAX + 1) * TRIANGLE_FLOATS
  const uvBytes = (many / XYZ_FLOATS) * UV_FLOATS * FLOAT_BYTES
  const over = {
    normals: zeros(many * FLOAT_BYTES),
    positions: zeros(many * FLOAT_BYTES),
    uvs: zeros(uvBytes),
  }
  expect(acceptsOne({ mesh: over })).toBe(false)
  expect(acceptsOne({ mesh: { ...card, indices: shorts([0, 1, 8]) } })).toBe(
    false,
  )
  expect(acceptsOne({ mesh: { ...card, uvs: floats([0, 0]) } })).toBe(false)
  const { indices: _dropped, ...unindexed } = card
  expect(acceptsOne({ mesh: unindexed })).toBe(false)
})

test('layer ids are unique, the count is capped, unknown keys are refused', (): void => {
  const many = Array.from(
    { length: DETAIL_LAYERS_MAX + 1 },
    (_unused: unknown, index: number): unknown => numbered(index),
  )
  expect(accepts([layer(), layer()])).toBe(false)
  expect(accepts(many)).toBe(false)
  expect(acceptsOne({ wind: 1 })).toBe(false)
  expect(acceptsOne({ clumps: 0 })).toBe(false)
})

test('a layer naming an undeclared material is a fault', (): void => {
  const rows = parse(LookDetailsSchema, [
    layer(),
    layer({ id: 'ferns', material: 'frond' }),
  ])
  expect(detailMaterialFaults(rows, { 'grass-card': {} })).toEqual([
    'detail ferns: material frond is not declared',
  ])
  expect(detailMaterialFaults(rows, { frond: {}, 'grass-card': {} })).toEqual(
    [],
  )
})
