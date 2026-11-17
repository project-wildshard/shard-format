/* oxlint-disable capitalized-comments, curly, id-length, import/exports-last, import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-array-callback-reference, unicorn/no-array-sort, unicorn/no-null -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4e2: collider rows and poses the golden vectors pin. The engine's readColliderRows, poseOf and placeCollider
// (three.js math, the oracle, colliders.golden-gen.mjs) and format's three-free copies read and place the same rows.
// Together they touch every branch: each shape kind, a collider's own yaw or rotation or none, an upright and a turned
// pose, a uniform scale, a matrix pose (turned, mirrored, translation-only, degenerate) and the row grammar's refusals.

export interface PlacementFixture {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw?: number
  readonly leanX?: number
  readonly leanZ?: number
  readonly scale?: number
  /** column-major, as three's `Matrix4.elements` */
  readonly matrix?: readonly number[]
}

const c = Math.cos(0.7),
  s = Math.sin(0.7)
export const POSE_CASES: readonly PlacementFixture[] = [
  { x: 0, y: 0, z: 0 },
  { x: 12.5, y: -3, z: 7.25, scale: 1.75 },
  { x: -40, y: 2, z: 19, yaw: 1.2 },
  { x: 3, y: 4, z: 5, yaw: -2.3, leanX: 0.15, leanZ: -0.08, scale: 0.6 },
  { x: 1, y: 2, z: 3, leanZ: 0.4 },
  {
    x: 10,
    y: 20,
    z: 30,
    matrix: [
      c * 2,
      0,
      -s * 2,
      0,
      0,
      2,
      0,
      0,
      s * 2,
      0,
      c * 2,
      0,
      10,
      20,
      30,
      1,
    ],
  },
  {
    x: 5,
    y: 0,
    z: -5,
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, -5, 1],
  },
  {
    x: 0,
    y: 1,
    z: 0,
    matrix: [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1],
  },
  {
    x: 2,
    y: 2,
    z: 2,
    matrix: [
      0.9, 0.3, -0.2, 0, -0.25, 0.8, 0.4, 0, 0.3, -0.35, 0.85, 0, 2, 2, 2, 1,
    ],
  },
  {
    x: 7,
    y: 7,
    z: 7,
    matrix: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 7, 1],
  },
]

export const COLLIDER_ROWS: readonly unknown[] = [
  {
    kind: 'box',
    x: 1,
    y: 0.5,
    z: -2,
    hx: 0.5,
    hy: 0.25,
    hz: 1.5,
    yaw: 0.3,
    surface: 'wood',
  },
  {
    kind: 'box',
    x: 0,
    y: 1,
    z: 0,
    hx: 1,
    hy: 1,
    hz: 1,
    rot: { x: 0.1, y: 0.2, z: 0.05, w: 0.97 },
  },
  { kind: 'capsule', x: -1, y: 1.2, z: 0.4, halfHeight: 0.8, radius: 0.3 },
  { kind: 'ball', x: 0.2, y: 0.3, z: 0.4, radius: 0.9, surface: 'rock' },
  {
    kind: 'hull',
    x: 0,
    y: 0,
    z: 0,
    points: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0.3, 0.3, 1.1],
    yaw: -0.5,
  },
  {
    kind: 'trimesh',
    x: 2,
    y: 0,
    z: 1,
    vertices: [0, 0, 0, 2, 0, 0, 0, 0, 2],
    indices: [0, 1, 2],
    surface: 'stone',
  },
  {
    kind: 'treads',
    from: { x: 0, y: 0, z: 0 },
    to: { x: 0, y: 2, z: 3 },
    width: 1.2,
    count: 6,
    surface: 'planks',
  },
]

export const SURFACES: readonly string[] = [
  'wood',
  'rock',
  'stone',
  'planks',
  'grass',
]
export const ALL_KINDS = [
  'box',
  'capsule',
  'ball',
  'hull',
  'trimesh',
  'treads',
] as const

/** Row batches the grammar admits or refuses, each with its policy. */
export const ROW_CASES: readonly {
  readonly rows: readonly unknown[]
  readonly kinds: readonly (typeof ALL_KINDS)[number][]
  readonly surfaces: readonly string[]
  readonly requireSurface?: boolean
}[] = [
  { rows: COLLIDER_ROWS, kinds: ALL_KINDS, surfaces: SURFACES },
  { rows: [], kinds: [], surfaces: [] },
  { rows: [COLLIDER_ROWS[0]], kinds: ['capsule'], surfaces: SURFACES },
  {
    rows: [COLLIDER_ROWS[2]],
    kinds: ALL_KINDS,
    surfaces: SURFACES,
    requireSurface: true,
  },
  { rows: [COLLIDER_ROWS[0]], kinds: ALL_KINDS, surfaces: ['rock'] },
  {
    rows: [{ kind: 'ball', x: 0, y: 0, z: 0, radius: Number.NaN }],
    kinds: ALL_KINDS,
    surfaces: SURFACES,
  },
  {
    rows: [{ kind: 'ball', x: 0, y: 0, z: 0, radius: 1, extra: 1 }],
    kinds: ALL_KINDS,
    surfaces: SURFACES,
  },
  {
    rows: [{ kind: 'hull', x: 0, y: 0, z: 0, points: [0, 1, 'x'] }],
    kinds: ALL_KINDS,
    surfaces: SURFACES,
  },
  {
    rows: [
      { kind: 'trimesh', x: 0, y: 0, z: 0, vertices: [0, 0, 0], indices: [-1] },
    ],
    kinds: ALL_KINDS,
    surfaces: SURFACES,
  },
  {
    rows: [
      {
        kind: 'trimesh',
        x: 0,
        y: 0,
        z: 0,
        vertices: [0, 0, 0],
        indices: [2 ** 32],
      },
    ],
    kinds: ALL_KINDS,
    surfaces: SURFACES,
  },
  {
    rows: [
      {
        kind: 'treads',
        from: { x: 0, y: 0, z: 0 },
        to: { x: 1, y: 1, z: 1 },
        width: 1,
        count: 0,
      },
    ],
    kinds: ALL_KINDS,
    surfaces: SURFACES,
  },
  {
    rows: [
      {
        kind: 'box',
        x: 0,
        y: 0,
        z: 0,
        hx: 1,
        hy: 1,
        hz: 1,
        rot: { x: 0, y: 0, z: 0 },
      },
    ],
    kinds: ALL_KINDS,
    surfaces: SURFACES,
  },
  { rows: [null], kinds: ALL_KINDS, surfaces: SURFACES },
]

/** IEEE-754 float64 bits, big-endian hex: the comparison is bit-exact, not approximate. */
export function bits(value: number): string {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  return view.getBigUint64(0).toString(16).padStart(16, '0')
}

/** A collider or pose as plain data: every number as float bits, typed lanes as their storage name and bits. */
export function plainBits(value: unknown): unknown {
  if (typeof value === 'number') return bits(value)
  if (
    value instanceof Float32Array ||
    value instanceof Uint32Array ||
    value instanceof Float64Array
  )
    return [value.constructor.name, ...[...value].map(bits)]
  if (Array.isArray(value)) return value.map(plainBits)
  if (typeof value === 'object' && value !== null)
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => [k, plainBits(v)]),
    )
  return value
}

/** One batch's answer: the admitted rows as plain bits, or the refusal. */
export function rowsAnswer(read: () => unknown): unknown {
  try {
    return { ok: plainBits(read()) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
