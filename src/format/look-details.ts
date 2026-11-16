/**
 * Detail layers (meta SHARD-SOURCE AP32a): grass, ferns and other small clutter as a card mesh plus a density mask, scattered
 * by the engine in a ring round the camera (its grass-carpet pattern, made general) instead of baked as thousands of instance
 * matrices. Absent: no layers (no default is filled, so older shard files keep their bytes).
 *
 * One `look.details` row:
 * - `id`: unique among the layers; it also seeds the scatter, so the same square metre always grows the same clumps.
 * - `material`: a `look.materials` id (or a family) the cards draw with.
 * - `mesh`: the card: a binary `file` (by hash) and its `vertices` and `triangles` counts (layout in
 *   `look-details-bytes.ts`). At most `DETAIL_MESH_TRIANGLES_MAX` triangles.
 * - `region`: the mask's grid: its low `corner` ([x, z] metres), `cell` size, `columns` (along x), `rows` (along z), and
 *   the `span` of y its heights cover.
 * - `mask`: a binary file, one u8 per cell, row by row from the low corner: 0 grows nothing, 255 grows `clumps` clumps.
 * - `heights`: a binary file, one u16 per cell: the ground under the cell's centre, `span[0] + h / 65535 × (span[1] -
 *   span[0])`.
 * - `clumps`: clumps in a full cell; `scale`, `tilt` (the most a clump leans, radians) and `tint` (two sRGB multipliers a
 *   clump's colour is picked between) vary each clump.
 * - `sway`: wind on the cards (`amount` of lean, `rate` in cycles a second); absent: still.
 * - `radius`: metres round the camera that grow the layer on desktop; phones grow half the radius (the engine's rule).
 * - `shadow`: the cards cast shadows.
 *
 * The files stay binary (engine G649). Their sizes are checked against the row where the bytes are at hand
 * (`detailFileFaults`); the shardfile rule checks they are declared binary files with no dependencies.
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

import {
  DETAIL_MESH_TRIANGLES_MAX,
  DETAIL_MESH_VERTICES_MAX,
} from './look-details-bytes.ts'
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
/** A shardfile file entry, as the rule reads it. */
interface DetailFileEntry {
  readonly hash: string
  readonly kind: string
  readonly dependencies: readonly string[]
}

/** At most this many detail layers in one look. */
const DETAIL_LAYERS_MAX = 8
/** At most this many mask columns or rows (512 × 512 cells). */
const DETAIL_SIDE_MAX = 512
/** At most this many clumps in a full cell. */
const DETAIL_CLUMPS_MAX = 64
const NONE = 0
const FULL = 1
const TRIANGLE = 3
const CELL_MIN = 0.5
const CELL_MAX = 8
const SCALE_MIN = 0.05
const SCALE_MAX = 20
const RATE_MIN = 0.05
const RATE_MAX = 10
const RADIUS_MIN = 4
const RADIUS_MAX = 200

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

/** True when `hash` is a declared binary file with no dependencies. */
function plainBinary(
  files: ReadonlyMap<string, DetailFileEntry>,
  hash: string,
): boolean {
  const file = files.get(hash)
  return file?.kind === 'binary' && file.dependencies.length === NONE
}

/** The shardfile rules: every layer's material is declared and its three files are plain binaries. */
function detailLayerRules(
  rows: readonly LookDetail[] | undefined,
  materials: Readonly<Record<string, unknown>>,
  files: readonly DetailFileEntry[],
): string[] {
  const layers = rows ?? []
  const byHash = new Map(
    files.map((file: DetailFileEntry): [string, DetailFileEntry] => [
      file.hash,
      file,
    ]),
  )
  const refs = layers.flatMap((row: LookDetail): string[] => [
    row.mesh.file,
    row.mask,
    row.heights,
  ])
  const errors: string[] = []
  if (detailMaterialFaults(layers, materials).length > NONE) {
    errors.push('declared detail layer material')
  }
  if (!refs.every((hash: string): boolean => plainBinary(byHash, hash))) {
    errors.push('detail layer files are declared binaries with no dependencies')
  }
  return errors
}

/** True when a layer's ranges run low to high and its mesh can index every triangle. */
function ordered(row: LookDetail): boolean {
  const spans =
    row.region.span[NONE] <= row.region.span[FULL] &&
    row.scale[NONE] <= row.scale[FULL]
  return spans && row.mesh.vertices >= TRIANGLE
}
/** True when no two layers share an id. */
function uniqueIds(rows: readonly LookDetail[]): boolean {
  return (
    new Set(rows.map((row: LookDetail): string => row.id)).size === rows.length
  )
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
const hash = pipe(string(), regex(/^[a-f0-9]{64}$/u))
const side = count(FULL, DETAIL_SIDE_MAX)
const size = range(SCALE_MIN, SCALE_MAX)
const pair = tuple([real, real])
const MeshSchema = strictObject({
  file: hash,
  triangles: count(FULL, DETAIL_MESH_TRIANGLES_MAX),
  vertices: count(FULL, DETAIL_MESH_VERTICES_MAX),
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
  heights: hash,
  id: identity,
  mask: hash,
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
const LookDetailSchema: GenericSchema<LookDetail, LookDetail> = pipe(
  DetailRowSchema,
  check<LookDetail, string>(
    ordered,
    'detail layer ranges run low to high and its mesh has a triangle',
  ),
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
  detailLayerRules,
  detailMaterialFaults,
}
export {
  DETAIL_MESH_TRIANGLES_MAX,
  DETAIL_MESH_VERTICES_MAX,
  detailFileFaults,
  detailMeshBytes,
  detailMeshViews,
} from './look-details-bytes.ts'
export type {
  DetailFileRow,
  LookDetailFiles,
  LookDetailMesh,
  LookDetailMeshViews,
} from './look-details-bytes.ts'
export type { DetailFileEntry, LookDetail, LookDetailRegion, LookDetailSway }
