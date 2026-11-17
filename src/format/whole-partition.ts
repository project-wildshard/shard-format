/* oxlint-disable curly, id-length, import/group-exports, import/no-namespace, init-declarations, no-bitwise, no-magic-numbers, no-plusplus, sort-vars, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls -- verbatim port of the engine's law (SDK-SPLIT SP4); the run-list grammar is pinned by golden vectors, so it keeps the engine's form */
/** SDK-SPLIT SP4e (Q35): a whole piece's partition row and its run-list form moved from engine
 *  `client/game/shardfile/wholeGeometryPieces.ts`, and the `WholeGeometryPiece` shape from `client/game/plugin/geometry.ts`
 *  (generic over the host's geometry and matrix); decoding a GLB node into pieces stays in the engine. */
import * as wholeV from 'valibot'

/** A run list expands to at most this many ordinals (a 2 MB GLB JSON chunk cannot otherwise bound it). */
const WHOLE_ORDINALS_MAX = 1 << 24
const WholeOrdinal = wholeV.pipe(
  wholeV.number(),
  wholeV.integer(),
  wholeV.minValue(0),
)
/** Ordinals as a plain list, or the baker's run-length form `{ runs: [start, length, …] }` (sharddev/bake/props `wholePartitionRuns`). */
/** A plain ordinal list, checked in one loop with WholeOrdinal's rules (valibot's per-element pipe over whole tiles' lists
 *  was ~150 ms of a phone-tier home region) */
const isOrdinals = (list: unknown): list is number[] =>
  Array.isArray(list) &&
  list.every(
    (ordinal: unknown) =>
      typeof ordinal === 'number' && Number.isInteger(ordinal) && ordinal >= 0,
  )
interface WholeOrdinalValues {
  readonly values: number[]
  readonly length: number
  readonly dense: boolean
}
function explicitWholeOrdinals(values: number[]): WholeOrdinalValues {
  // Explicit caller arrays retain their original reference and live length.
  return {
    values,
    get length(): number {
      return values.length
    },
    dense: false,
  }
}
function runWholeOrdinals(runs: number[]): WholeOrdinalValues {
  let values: number[] | undefined
  const length = runs.reduce(
    (sum, ordinal, i) => sum + (i % 2 === 1 ? ordinal : 0),
    0,
  )
  return {
    length,
    dense: runs.length === 2 && runs[0] === 0,
    get values(): number[] {
      if (values === undefined) {
        values = []
        for (let i = 0; i < runs.length; i += 2) {
          const start = runs[i] ?? 0,
            count = runs[i + 1] ?? 0
          for (let k = 0; k < count; k++) values.push(start + k)
        }
      }
      return values
    },
  }
}
const WholeOrdinals = wholeV.union([
  wholeV.pipe(
    wholeV.custom<number[]>(
      isOrdinals,
      'whole ordinals are non-negative integers',
    ),
    wholeV.transform(explicitWholeOrdinals),
  ),
  wholeV.pipe(
    wholeV.strictObject({ runs: wholeV.array(WholeOrdinal) }),
    wholeV.check(
      row =>
        row.runs.length % 2 === 0 &&
        row.runs.every((ordinal, i) => i % 2 === 0 || ordinal > 0) &&
        row.runs.reduce(
          (sum, ordinal, i) => sum + (i % 2 === 1 ? ordinal : 0),
          0,
        ) <= WHOLE_ORDINALS_MAX,
      'whole ordinal runs are bounded start/length pairs',
    ),
    wholeV.transform(row => runWholeOrdinals(row.runs)),
  ),
])
const WholePartition = wholeV.pipe(
  wholeV.strictObject({
    id: wholeV.string(),
    vertices: WholeOrdinals,
    triangles: WholeOrdinals,
    vertexCount: wholeV.pipe(
      wholeV.number(),
      wholeV.integer(),
      wholeV.minValue(1),
    ),
    indexCount: wholeV.pipe(
      wholeV.number(),
      wholeV.integer(),
      wholeV.minValue(0),
    ),
    index: wholeV.picklist(['none', 'u16', 'u32']),
    // I3: the partition's positions are unnormalized Int16 on this grid of its whole shape (sharddev/bake/props `wholeGrid`)
    grid: wholeV.exactOptional(
      wholeV.strictObject({
        origin: wholeV.tuple([
          wholeV.number(),
          wholeV.number(),
          wholeV.number(),
        ]),
        step: wholeV.pipe(
          wholeV.number(),
          wholeV.minValue(1 / 4096),
          wholeV.maxValue(1),
        ),
      }),
    ),
  }),
  // The proof lives only in this parsed row: caller-owned explicit arrays
  // never qualify, even when they currently look like a complete run.
  wholeV.transform(row => ({
    ...row,
    get vertices(): number[] {
      return row.vertices.values
    },
    get vertexLength(): number {
      return row.vertices.length
    },
    get triangles(): number[] {
      return row.triangles.values
    },
    get triangleLength(): number {
      return row.triangles.length
    },
    denseVertices: row.vertices.dense,
    denseTriangles: row.triangles.dense,
  })),
)
/** Admitted partition lanes retain their existing lazy ordinal expansion. */
export interface WholePartitionRow {
  readonly id: string
  readonly vertices: number[]
  readonly triangles: number[]
  readonly vertexCount: number
  readonly indexCount: number
  readonly index: 'none' | 'u16' | 'u32'
  readonly grid?: {
    readonly origin: [number, number, number]
    readonly step: number
  }
  readonly vertexLength: number
  readonly triangleLength: number
  readonly denseVertices: boolean
  readonly denseTriangles: boolean
}
/** The same bounded ordinal grammar for partial and complete whole intake. */
export function readWholePartition(input: unknown): WholePartitionRow {
  return wholeV.parse(WholePartition, input)
}

/** A verified subset of one original draw. Ordinals identify its exact source vertices and triangles; completeness belongs
 *  to the full-model reader. `Geometry` and `Matrix` are the host's (three's `BufferGeometry` and `Matrix4` in the engine). */
export interface WholeGeometryPiece<Geometry = unknown, Matrix = unknown> {
  readonly geometry: Geometry
  readonly matrix: Matrix
  /** Forget decoded-source ownership after adopting or copying it into a scope-owned render object. */
  readonly release?: () => void
  readonly part: string
  readonly vertices: readonly number[]
  readonly triangles: readonly number[]
  readonly vertexCount: number
  readonly indexCount: number
  readonly layout: string
}
