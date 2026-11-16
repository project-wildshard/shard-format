/**
 * Detail layers (meta SHARD-SOURCE AP32a): grass, ferns and other small clutter as a card mesh plus a density mask, scattered
 * by the engine in a ring round the camera (its grass-carpet pattern, made general) instead of baked as thousands of instance
 * matrices. Absent: no layers (no default is filled, so older shard files keep their bytes).
 *
 * One `look.details` row:
 * - `id`: unique among the layers; it also seeds the scatter, so the same square metre always grows the same clumps.
 * - `material`: a `look.materials` id (or a family) the cards draw with.
 * - `mesh`: the card, base64 little-endian: `positions` and `normals` f32 xyz, `uvs` f32 uv, optional `indices` u16
 *   (absent: a plain triangle list). At most `DETAIL_MESH_TRIANGLES_MAX` triangles.
 * - `region`: the mask's grid: its low `corner` ([x, z] metres), `cell` size, `columns` (along x), `rows` (along z), and
 *   the `span` of y its heights cover.
 * - `mask`: base64 u8, one byte per cell, row by row from the low corner: 0 grows nothing, 255 grows `clumps` clumps.
 * - `heights`: base64 u16 little-endian, one per cell: the ground under the cell's centre, `span[0] + h / 65535 × (span[1] -
 *   span[0])`.
 * - `clumps`: clumps in a full cell; `scale`, `tilt` (the most a clump leans, radians) and `tint` (two sRGB multipliers a
 *   clump's colour is picked between) vary each clump.
 * - `sway`: wind on the cards (`amount` of lean, `rate` in cycles a second); absent: still.
 * - `radius`: metres round the camera that grow the layer on desktop; phones grow half the radius (the engine's rule).
 * - `shadow`: the cards cast shadows.
 *
 * Plain data and checks, no three.js.
 */
import {
  array,
  boolean,
  check,
  exactOptional,
  finite,
  integer,
  maxLength,
  maxValue,
  minValue,
  number,
  pipe,
  regex,
  string,
  strictObject,
  tuple,
} from 'valibot'

import { base64Bytes, faultsOf, meshFaults } from './look-details-bytes.ts'
import { materialExists } from './materials.ts'

import type { LookDetailMesh } from './look-details-bytes.ts'
import type { GenericSchema } from 'valibot'

type Rgb = readonly [number, number, number]
type Pair = readonly [number, number]

/** A layer's mask grid. */
interface LookDetailRegion {
  readonly corner: Pair
  readonly cell: number
  readonly columns: number
  readonly rows: number
  readonly span: Pair
}
/** Wind on a layer's cards. */
interface LookDetailSway {
  readonly amount: number
  readonly rate: number
}
/** One detail layer. */
interface LookDetail {
  readonly id: string
  readonly material: string
  readonly mesh: LookDetailMesh
  readonly region: LookDetailRegion
  readonly mask: string
  readonly heights: string
  readonly clumps: number
  readonly scale: Pair
  readonly tilt: number
  readonly tint: readonly [Rgb, Rgb]
  readonly sway?: LookDetailSway
  readonly radius: number
  readonly shadow: boolean
}

/** At most this many detail layers in one look. */
const DETAIL_LAYERS_MAX = 8
/** At most this many mask columns or rows (512 × 512 cells). */
const DETAIL_SIDE_MAX = 512
/** At most this many clumps in a full cell. */
const DETAIL_CLUMPS_MAX = 64
const NONE = 0
const FULL = 1
const U16_BYTES = 2
const CELL_MIN = 0.5
const CELL_MAX = 8
const SCALE_MIN = 0.05
const SCALE_MAX = 20
const RATE_MIN = 0.05
const RATE_MAX = 10
const RADIUS_MIN = 4
const RADIUS_MAX = 200

/** The faults in one layer's byte sizes, ranges and indices, or none. */
function detailLayerFaults(row: LookDetail): string[] {
  const cells = row.region.columns * row.region.rows
  const mask = base64Bytes(row.mask)
  const heights = base64Bytes(row.heights)
  return [
    ...faultsOf([
      [
        mask !== cells,
        `detail ${row.id}: mask holds ${String(mask)} bytes, the region has ${String(cells)} cells`,
      ],
      [
        heights !== cells * U16_BYTES,
        `detail ${row.id}: heights hold ${String(heights)} bytes, the region needs ${String(cells * U16_BYTES)}`,
      ],
      [
        row.region.span[FULL] < row.region.span[NONE],
        `detail ${row.id}: region span runs low to high`,
      ],
      [
        row.scale[FULL] < row.scale[NONE],
        `detail ${row.id}: scale runs low to high`,
      ],
    ]),
    ...meshFaults(row.id, row.mesh),
  ]
}

/** The layers whose material names no `look.materials` entry or family. */
function detailMaterialFaults(
  rows: readonly LookDetail[],
  materials: Readonly<Record<string, unknown>>,
): string[] {
  const missing = rows.filter(
    (row: LookDetail): boolean => !materialExists(materials, row.material),
  )
  return missing.map(
    (row: LookDetail): string =>
      `detail ${row.id}: material ${row.material} is not declared`,
  )
}

/** The shardfile rule: `['declared detail layer material']` when a layer names an undeclared material, else none. */
function detailLayerRules(
  rows: readonly LookDetail[] | undefined,
  materials: Readonly<Record<string, unknown>>,
): string[] {
  return detailMaterialFaults(rows ?? [], materials).length === NONE
    ? []
    : ['declared detail layer material']
}

function range(low: number, high: number): GenericSchema<number, number> {
  return pipe(number(), finite(), minValue(low), maxValue(high))
}
function count(low: number, high: number): GenericSchema<number, number> {
  return pipe(number(), integer(), minValue(low), maxValue(high))
}

const real = pipe(number(), finite())
const unit = range(NONE, FULL)
const rgb = tuple([unit, unit, unit])
const identity = pipe(string(), regex(/^[a-z0-9][a-z0-9._-]{0,63}$/u))
const base64 = pipe(
  string(),
  regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u),
)
const side = count(FULL, DETAIL_SIDE_MAX)
const size = range(SCALE_MIN, SCALE_MAX)
const pair = tuple([real, real])
const MeshSchema = strictObject({
  indices: exactOptional(base64),
  normals: base64,
  positions: base64,
  uvs: base64,
})
const RegionSchema = strictObject({
  cell: range(CELL_MIN, CELL_MAX),
  columns: side,
  corner: pair,
  rows: side,
  span: pair,
})
const SwaySchema = strictObject({
  amount: unit,
  rate: range(RATE_MIN, RATE_MAX),
})
const DetailRowSchema: GenericSchema<LookDetail, LookDetail> = strictObject({
  clumps: count(FULL, DETAIL_CLUMPS_MAX),
  heights: base64,
  id: identity,
  mask: base64,
  material: identity,
  mesh: MeshSchema,
  radius: range(RADIUS_MIN, RADIUS_MAX),
  region: RegionSchema,
  scale: tuple([size, size]),
  shadow: boolean(),
  sway: exactOptional(SwaySchema),
  tilt: unit,
  tint: tuple([rgb, rgb]),
})
/** True when a layer's bytes fit its region and mesh caps. */
function fitsBytes(row: LookDetail): boolean {
  return detailLayerFaults(row).length === NONE
}
/** True when no two layers share an id. */
function uniqueIds(rows: readonly LookDetail[]): boolean {
  return (
    new Set(rows.map((row: LookDetail): string => row.id)).size === rows.length
  )
}

const LookDetailSchema: GenericSchema<LookDetail, LookDetail> = pipe(
  DetailRowSchema,
  check<LookDetail, string>(fitsBytes, 'detail layer byte sizes and indices'),
)
/** `look.details`: at most `DETAIL_LAYERS_MAX` layers with unique ids. */
const LookDetailsSchema: GenericSchema<LookDetail[], LookDetail[]> = pipe(
  array(LookDetailSchema),
  maxLength(DETAIL_LAYERS_MAX),
  check<LookDetail[], string>(uniqueIds, 'detail layer ids are unique'),
)

export {
  DETAIL_CLUMPS_MAX,
  DETAIL_LAYERS_MAX,
  DETAIL_SIDE_MAX,
  LookDetailsSchema,
  detailLayerFaults,
  detailLayerRules,
  detailMaterialFaults,
}
export {
  DETAIL_MESH_TRIANGLES_MAX,
  base64Bytes,
  decodeBase64,
} from './look-details-bytes.ts'
export type { LookDetailMesh } from './look-details-bytes.ts'
export type { LookDetail, LookDetailRegion, LookDetailSway }
