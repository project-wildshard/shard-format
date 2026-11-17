/* oxlint-disable import/exports-last, import/group-exports, no-bitwise, no-magic-numbers, unicorn/no-null -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4e: stored geometry layouts the golden vectors pin. The engine's NativeAttributesSchema and
// readWholePartition (the oracle, geometry-layout.golden-gen.mjs) and format's read the same inputs; each answer is the
// admitted row (run lists expanded) or the refusal's message.

const channel = {
  semantic: 'POSITION',
  storage: 'Float32Array',
  normalized: false,
  itemSize: 3,
}
export const CHANNEL_CASES: readonly unknown[] = [
  { position: channel },
  {
    position: { ...channel, storage: 'Int16Array' },
    normal: {
      semantic: 'NORMAL',
      storage: 'Int8Array',
      normalized: true,
      itemSize: 4,
    },
    aFace: {
      semantic: '_AFACE',
      storage: 'Float16Array',
      normalized: false,
      itemSize: 1,
    },
  },
  {
    uv: {
      semantic: 'TEXCOORD_0',
      storage: 'Uint16Array',
      normalized: true,
      itemSize: 2,
    },
    color: {
      semantic: 'COLOR_0',
      storage: 'Uint8Array',
      normalized: true,
      itemSize: 4,
    },
    ids: {
      semantic: '_ID',
      storage: 'Uint32Array',
      normalized: false,
      itemSize: 1,
    },
  },
  {},
  { position: { ...channel, storage: 'Float64Array' } },
  { position: { ...channel, itemSize: 5 } },
  { position: { ...channel, itemSize: 1.5 } },
  { position: { ...channel, extra: 1 } },
  { position: { semantic: 'POSITION', storage: 'Float32Array', itemSize: 3 } },
  [channel],
  null,
]

const base = { id: 'roof', vertexCount: 12, indexCount: 18, index: 'u16' }
export const PARTITION_CASES: readonly unknown[] = [
  { ...base, vertices: [0, 1, 2, 3], triangles: [0, 1] },
  { ...base, vertices: { runs: [0, 12] }, triangles: { runs: [0, 6] } },
  {
    ...base,
    vertices: { runs: [2, 3, 9, 2] },
    triangles: { runs: [1, 1, 4, 2] },
    index: 'u32',
  },
  {
    ...base,
    index: 'none',
    indexCount: 0,
    vertices: { runs: [3, 6] },
    triangles: { runs: [1, 2] },
    grid: { origin: [1.5, -2, 0.25], step: 1 / 256 },
  },
  { ...base, vertices: [], triangles: [] },
  { ...base, vertices: { runs: [0, 3, 5] }, triangles: [0] },
  { ...base, vertices: { runs: [0, 0] }, triangles: [0] },
  { ...base, vertices: { runs: [0, 1 << 24, 1 << 24, 1] }, triangles: [0] },
  { ...base, vertices: { runs: [0, 1 << 24] }, triangles: [0] },
  { ...base, vertices: [0, -1], triangles: [0] },
  { ...base, vertices: [0, 1.5], triangles: [0] },
  { ...base, vertices: [0], triangles: [0], vertexCount: 0 },
  { ...base, vertices: [0], triangles: [0], index: 'u8' },
  {
    ...base,
    vertices: [0],
    triangles: [0],
    grid: { origin: [0, 0, 0], step: 2 },
  },
  {
    ...base,
    vertices: [0],
    triangles: [0],
    grid: { origin: [0, 0, 0], step: 1 / 8192 },
  },
  { ...base, vertices: [0], triangles: [0], extra: true },
  {
    vertices: [0],
    triangles: [0],
    vertexCount: 1,
    indexCount: 0,
    index: 'none',
  },
  { ...base, vertices: { runs: [0, 2], more: 1 }, triangles: [0] },
]

/** One admitted partition as plain data (its run lists expanded), or the refusal. */
export function partitionAnswer(
  read: (input: unknown) => {
    readonly id: string
    readonly vertices: readonly number[]
    readonly triangles: readonly number[]
    readonly vertexCount: number
    readonly indexCount: number
    readonly index: string
    readonly grid?: {
      readonly origin: readonly number[]
      readonly step: number
    }
    readonly vertexLength: number
    readonly triangleLength: number
    readonly denseVertices: boolean
    readonly denseTriangles: boolean
  },
  input: unknown,
): unknown {
  try {
    const row = read(input)
    const vertices =
      row.vertices.length > 64
        ? `${row.vertices.length} from ${row.vertices[0]}`
        : [...row.vertices]
    return {
      id: row.id,
      vertices,
      triangles: [...row.triangles],
      vertexCount: row.vertexCount,
      indexCount: row.indexCount,
      index: row.index,
      grid: row.grid ?? null,
      vertexLength: row.vertexLength,
      triangleLength: row.triangleLength,
      denseVertices: row.denseVertices,
      denseTriangles: row.denseTriangles,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** One channel table's answer: the admitted rows, or the refusal. */
export function channelAnswer(
  parse: (input: unknown) => unknown,
  input: unknown,
): unknown {
  try {
    return { ok: parse(input) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
