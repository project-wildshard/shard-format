/* oxlint-disable capitalized-comments, complexity, curly, id-length, import/exports-last, import/group-exports, import/no-namespace, init-declarations, max-lines, max-lines-per-function, max-params, max-statements, no-implicit-coercion, no-magic-numbers, no-negated-condition, no-nested-ternary, no-plusplus, oxc/erasing-op, sort-vars, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls, unicorn/no-negated-condition, unicorn/no-nested-ternary, unicorn/no-zero-fractions, unicorn/number-literal-case, unicorn/numeric-separators-style, unicorn/prefer-modern-math-apis, unicorn/switch-case-braces -- verbatim port of the engine's law and three's arithmetic (SDK-SPLIT SP4); bit-exact output is pinned by golden vectors, so it keeps their form */
/**
 * SDK-SPLIT SP4e2 (Q35): collider rows and how a pose places them, moved from engine `client/engine/models/colliders.ts`
 * without three.js. The row grammar (`readColliderRows`) is verbatim; `poseOf` and `placeCollider` run three's own
 * Matrix4 / Quaternion / Vector3 arithmetic, written out in the same operation order, so a placed collider is bit for bit
 * the engine's (golden vectors). A pose's matrix is 16 numbers, column-major as three's `Matrix4.elements`. The engine keeps
 * the geometry half (`poseGeometry`, the drawn hulls) and wraps these for its `THREE.Matrix4` placements.
 */
import * as val from 'valibot'

interface Vec3 {
  x: number
  y: number
  z: number
}
interface Quat {
  x: number
  y: number
  z: number
  w: number
}

/** How a collider is placed: a centre, and either a turn about +Y (three's convention) or a full rotation. */
interface Placed<S extends string> {
  x: number
  y: number
  z: number
  yaw?: number
  rot?: Quat
  surface?: S
}

/** A collider as engine-neutral data (the engine's registry `ColliderDesc`), over the host's surface names. */
export type ColliderDesc<S extends string = string> =
  /** a box: half-extents along its own axes */
  | (Placed<S> & { kind: 'box'; hx: number; hy: number; hz: number })
  /** an upright capsule (or tilted by `rot`): the straight part's half-height, the radius */
  | (Placed<S> & { kind: 'capsule'; halfHeight: number; radius: number })
  | (Placed<S> & { kind: 'ball'; radius: number })
  /** a convex hull of points given relative to (x, y, z) */
  | (Placed<S> & { kind: 'hull'; points: Float32Array })
  /** a triangle mesh relative to (x, y, z) — only where you walk inside or over irregular geometry */
  | (Placed<S> & {
      kind: 'trimesh'
      vertices: Float32Array
      indices: Uint32Array
    })
  /**
   * a stair: `count` boxes rising `rise` each from `from` (the foot of the first tread) toward `to` (the top edge,
   * at from.y + count × rise), `width` across — built as treads, never as a ramp (PHYSICS.md: autostep climbs them).
   */
  | {
      kind: 'treads'
      from: Vec3
      to: Vec3
      width: number
      count: number
      surface?: S
    }

function finiteLaneValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('Collider values must be finite')
  return value
}
function copyLane<T extends Float32Array | Uint32Array>(
  values: readonly unknown[],
  Storage: new (length: number) => T,
  read: (value: unknown) => number,
): T {
  const count = values.length
  if (!Number.isSafeInteger(count) || count < 0 || count > 6_000_000)
    throw new Error('Collider geometry must be a bounded array')
  const owned = new Storage(count)
  // Use indexed facts, never a caller's custom iterator or a changing length.
  for (let i = 0; i < count; i++) owned[i] = read(values[i])
  return owned
}
function indexLaneValue(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0xffff_ffff
  )
    throw new Error('Collider indices must fit Uint32')
  return value
}

// H4: cache only the grammar, never admitted rows or caller-owned geometry.
// Compare surface values so mutation or a different policy cannot reuse a stale picklist.
function colliderSchema(surfaces: readonly string[]) {
  const finite = val.pipe(
    val.number('Collider values must be finite'),
    val.finite('Collider values must be finite'),
  )
  const point = val.strictObject(
    { x: finite, y: finite, z: finite },
    'Collider lacks an endpoint',
  )
  const surface = val.exactOptional(val.picklist(surfaces))
  const at = {
    x: finite,
    y: finite,
    z: finite,
    yaw: val.exactOptional(finite),
    rot: val.exactOptional(
      val.strictObject({ x: finite, y: finite, z: finite, w: finite }),
    ),
    surface,
  }
  // Borrow bounded storage, then validate each value while copying it once.
  // A lane accessor cannot change a checked value before its owned conversion.
  const lane = val.custom<unknown[]>(
    input => Array.isArray(input) && input.length <= 6_000_000,
    'Collider geometry must be a bounded array',
  )
  return val.variant('kind', [
    val.strictObject({
      kind: val.literal('box'),
      ...at,
      hx: finite,
      hy: finite,
      hz: finite,
    }),
    val.strictObject({
      kind: val.literal('capsule'),
      ...at,
      halfHeight: finite,
      radius: finite,
    }),
    val.strictObject({ kind: val.literal('ball'), ...at, radius: finite }),
    val.strictObject({ kind: val.literal('hull'), ...at, points: lane }),
    val.strictObject({
      kind: val.literal('trimesh'),
      ...at,
      vertices: lane,
      indices: lane,
    }),
    val.strictObject({
      kind: val.literal('treads'),
      from: point,
      to: point,
      width: finite,
      count: val.pipe(finite, val.integer(), val.minValue(1)),
      surface,
    }),
  ])
}
let recentGrammar:
  | { surfaces: readonly string[]; schema: ReturnType<typeof colliderSchema> }
  | undefined
function colliderGrammar(
  surfaces: readonly string[],
): ReturnType<typeof colliderSchema> {
  const previous = recentGrammar
  if (
    previous !== undefined &&
    surfaces.length === previous.surfaces.length &&
    surfaces.every((surface, index) => surface === previous.surfaces[index])
  )
    return previous.schema
  const owned = [...surfaces],
    schema = colliderSchema(owned)
  recentGrammar = { surfaces: owned, schema }
  return schema
}

/** Decode fresh registry descriptors from serialized facts. Callers explicitly admit shape kinds and surfaces;
 * absent surfaces stay absent, unless requireSurface is true. No physics objects are created here.
 * At most 65,536 rows and 6,000,000 values per geometry lane are admitted; indices must fit Uint32. */
export function readColliderRows<S extends string>(
  rows: readonly unknown[],
  policy: {
    readonly kinds: readonly ColliderDesc['kind'][]
    readonly surfaces: readonly S[]
    readonly requireSurface?: boolean
  },
): ColliderDesc<S>[] {
  if (rows.length > 65_536) throw new Error('Collider row bound exceeded')
  // Collision-free model copies need no shape grammar or policy traversal.
  if (rows.length === 0) return []
  const schema = colliderGrammar(policy.surfaces)
  return rows.map(raw => {
    if (
      typeof raw !== 'object' ||
      raw === null ||
      !('kind' in raw) ||
      !policy.kinds.some(kind => kind === raw.kind)
    )
      throw new Error('Unexpected collider shape')
    const actual = 'surface' in raw ? raw.surface : undefined
    if (
      (actual === undefined && policy.requireSurface === true) ||
      (actual !== undefined &&
        !policy.surfaces.some(allowed => allowed === actual))
    )
      throw new Error('Unexpected collider surface')
    // the picklist admitted only the policy's surfaces, so the row's surface is an S
    const row = val.parse(schema, raw) as ColliderDescRow<S>
    if (row.kind === 'hull')
      return {
        ...row,
        points: copyLane(row.points, Float32Array, finiteLaneValue),
      }
    if (row.kind === 'trimesh')
      return {
        ...row,
        vertices: copyLane(row.vertices, Float32Array, finiteLaneValue),
        indices: copyLane(row.indices, Uint32Array, indexLaneValue),
      }
    return row
  })
}
/** a parsed row before its lanes are copied into owned typed storage */
type ColliderDescRow<S extends string> =
  | Exclude<ColliderDesc<S>, { kind: 'hull' | 'trimesh' }>
  | (Placed<S> & { kind: 'hull'; points: unknown[] })
  | (Placed<S> & { kind: 'trimesh'; vertices: unknown[]; indices: unknown[] })

/** A placement's pose: scale, yaw, lean X, lean Z, then the position; or a full matrix (column-major, three's
 *  `Matrix4.elements`) whose translation is x, y, z. */
export interface PosePlacement {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw?: number
  readonly leanX?: number
  readonly leanZ?: number
  readonly scale?: number
  readonly matrix?: ArrayLike<number>
}

/** one copy's transform: the matrix, and its rotation and uniform scale taken apart once */
export interface Pose {
  readonly x: number
  readonly y: number
  readonly z: number
  /** column-major, as three's `Matrix4.elements` */
  readonly matrix: Float64Array
  readonly quat: Quat
  readonly scale: number
  /** no rotation at all (the colliders keep their own yaw exactly) */
  readonly upright: boolean
}

type M4 = Float64Array
/** three's `Matrix4.set`: row-major arguments into column-major elements */
function set(
  te: M4,
  n11: number,
  n12: number,
  n13: number,
  n14: number,
  n21: number,
  n22: number,
  n23: number,
  n24: number,
  n31: number,
  n32: number,
  n33: number,
  n34: number,
  n41: number,
  n42: number,
  n43: number,
  n44: number,
): M4 {
  te[0] = n11
  te[4] = n12
  te[8] = n13
  te[12] = n14
  te[1] = n21
  te[5] = n22
  te[9] = n23
  te[13] = n24
  te[2] = n31
  te[6] = n32
  te[10] = n33
  te[14] = n34
  te[3] = n41
  te[7] = n42
  te[11] = n43
  te[15] = n44
  return te
}
function rotationX(te: M4, theta: number): M4 {
  const c = Math.cos(theta),
    s = Math.sin(theta)
  return set(te, 1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1)
}
function rotationY(te: M4, theta: number): M4 {
  const c = Math.cos(theta),
    s = Math.sin(theta)
  return set(te, c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1)
}
function rotationZ(te: M4, theta: number): M4 {
  const c = Math.cos(theta),
    s = Math.sin(theta)
  return set(te, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
}
/** three's `Matrix4.premultiply(m)` (`multiplyMatrices(m, this)`): te = ae × te */
function premultiply(te: M4, ae: M4): void {
  const be = te
  const a11 = ae[0] ?? 0,
    a12 = ae[4] ?? 0,
    a13 = ae[8] ?? 0,
    a14 = ae[12] ?? 0
  const a21 = ae[1] ?? 0,
    a22 = ae[5] ?? 0,
    a23 = ae[9] ?? 0,
    a24 = ae[13] ?? 0
  const a31 = ae[2] ?? 0,
    a32 = ae[6] ?? 0,
    a33 = ae[10] ?? 0,
    a34 = ae[14] ?? 0
  const a41 = ae[3] ?? 0,
    a42 = ae[7] ?? 0,
    a43 = ae[11] ?? 0,
    a44 = ae[15] ?? 0
  const b11 = be[0] ?? 0,
    b12 = be[4] ?? 0,
    b13 = be[8] ?? 0,
    b14 = be[12] ?? 0
  const b21 = be[1] ?? 0,
    b22 = be[5] ?? 0,
    b23 = be[9] ?? 0,
    b24 = be[13] ?? 0
  const b31 = be[2] ?? 0,
    b32 = be[6] ?? 0,
    b33 = be[10] ?? 0,
    b34 = be[14] ?? 0
  const b41 = be[3] ?? 0,
    b42 = be[7] ?? 0,
    b43 = be[11] ?? 0,
    b44 = be[15] ?? 0
  te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41
  te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42
  te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43
  te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44
  te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41
  te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42
  te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43
  te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44
  te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41
  te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42
  te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43
  te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44
  te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41
  te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42
  te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43
  te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44
}
/** three's `Quaternion.setFromRotationMatrix` (the upper 3x3 a pure rotation) */
function quatOfRotation(te: M4): Quat {
  const m11 = te[0] ?? 0,
    m12 = te[4] ?? 0,
    m13 = te[8] ?? 0,
    m21 = te[1] ?? 0,
    m22 = te[5] ?? 0,
    m23 = te[9] ?? 0,
    m31 = te[2] ?? 0,
    m32 = te[6] ?? 0,
    m33 = te[10] ?? 0,
    trace = m11 + m22 + m33
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0)
    return {
      x: (m32 - m23) * s,
      y: (m13 - m31) * s,
      z: (m21 - m12) * s,
      w: 0.25 / s,
    }
  } else if (m11 > m22 && m11 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33)
    return {
      x: 0.25 * s,
      y: (m12 + m21) / s,
      z: (m13 + m31) / s,
      w: (m32 - m23) / s,
    }
  } else if (m22 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33)
    return {
      x: (m12 + m21) / s,
      y: 0.25 * s,
      z: (m23 + m32) / s,
      w: (m13 - m31) / s,
    }
  }
  const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22)
  return {
    x: (m13 + m31) / s,
    y: (m23 + m32) / s,
    z: 0.25 * s,
    w: (m21 - m12) / s,
  }
}
/** three's `Matrix4.decompose`: the rotation and the x scale (the position is the caller's) */
function decompose(te: M4): { quat: Quat; sx: number } {
  const n11 = te[0] ?? 0,
    n12 = te[4] ?? 0,
    n13 = te[8] ?? 0
  const n21 = te[1] ?? 0,
    n22 = te[5] ?? 0,
    n23 = te[9] ?? 0
  const n31 = te[2] ?? 0,
    n32 = te[6] ?? 0,
    n33 = te[10] ?? 0
  const det =
    n11 * (n22 * n33 - n23 * n32) -
    n12 * (n21 * n33 - n23 * n31) +
    n13 * (n21 * n32 - n22 * n31)
  if (det === 0) return { quat: { x: 0, y: 0, z: 0, w: 1 }, sx: 1 }
  let sx = Math.sqrt(n11 * n11 + n21 * n21 + n31 * n31)
  const sy = Math.sqrt(n12 * n12 + n22 * n22 + n32 * n32)
  const sz = Math.sqrt(n13 * n13 + n23 * n23 + n33 * n33)
  // if determinant is negative, we need to invert one scale
  if (det < 0) sx = -sx
  const m = Float64Array.from(te)
  const invSX = 1 / sx,
    invSY = 1 / sy,
    invSZ = 1 / sz
  m[0] = n11 * invSX
  m[1] = n21 * invSX
  m[2] = n31 * invSX
  m[4] = n12 * invSY
  m[5] = n22 * invSY
  m[6] = n32 * invSY
  m[8] = n13 * invSZ
  m[9] = n23 * invSZ
  m[10] = n33 * invSZ
  return { quat: quatOfRotation(m), sx }
}
/** three's `Vector3.applyMatrix4`: the point (x, y, z) through the matrix, with the perspective divide */
function applyMatrix4(x: number, y: number, z: number, e: M4): Vec3 {
  const w =
    1 / ((e[3] ?? 0) * x + (e[7] ?? 0) * y + (e[11] ?? 0) * z + (e[15] ?? 0))
  return {
    x: ((e[0] ?? 0) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z + (e[12] ?? 0)) * w,
    y: ((e[1] ?? 0) * x + (e[5] ?? 0) * y + (e[9] ?? 0) * z + (e[13] ?? 0)) * w,
    z:
      ((e[2] ?? 0) * x + (e[6] ?? 0) * y + (e[10] ?? 0) * z + (e[14] ?? 0)) * w,
  }
}
/** three's `Quaternion.multiplyQuaternions(a, b)` */
function multiplyQuaternions(a: Quat, b: Quat): Quat {
  const qax = a.x,
    qay = a.y,
    qaz = a.z,
    qaw = a.w
  const qbx = b.x,
    qby = b.y,
    qbz = b.z,
    qbw = b.w
  return {
    x: qax * qbw + qaw * qbx + qay * qbz - qaz * qby,
    y: qay * qbw + qaw * qby + qaz * qbx - qax * qbz,
    z: qaz * qbw + qaw * qbz + qax * qby - qay * qbx,
    w: qaw * qbw - qax * qbx - qay * qby - qaz * qbz,
  }
}

/** The pose of a placement: scale, yaw, lean X, lean Z, then the position (or its matrix). */
export function poseOf(pl: PosePlacement): Pose {
  const matrix = new Float64Array(16),
    m = new Float64Array(16)
  if (pl.matrix === undefined) {
    const s = pl.scale ?? 1
    set(matrix, s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1)
    if (pl.yaw !== undefined) premultiply(matrix, rotationY(m, pl.yaw))
    if (pl.leanX !== undefined) premultiply(matrix, rotationX(m, pl.leanX))
    if (pl.leanZ !== undefined) premultiply(matrix, rotationZ(m, pl.leanZ))
    premultiply(
      matrix,
      set(m, 1, 0, 0, pl.x, 0, 1, 0, pl.y, 0, 0, 1, pl.z, 0, 0, 0, 1),
    )
  } else for (let i = 0; i < 16; i++) matrix[i] = pl.matrix[i] ?? 0
  const { quat, sx } = decompose(matrix)
  const upright =
    pl.matrix === undefined
      ? (pl.yaw ?? 0) === 0 && (pl.leanX ?? 0) === 0 && (pl.leanZ ?? 0) === 0
      : Math.abs(quat.w) > 1 - 1e-12
  return { x: pl.x, y: pl.y, z: pl.z, matrix, quat, scale: sx, upright }
}

const scaled = (a: Float32Array, s: number): Float32Array =>
  s === 1 ? a : a.map(v => v * s)

/** one own-space collider at a copy's pose, in world space */
export function placeCollider<S extends string>(
  d: ColliderDesc<S>,
  pose: Pose,
): ColliderDesc<S> {
  const s = pose.scale
  if (d.kind === 'treads') {
    const from = applyMatrix4(d.from.x, d.from.y, d.from.z, pose.matrix)
    const to = applyMatrix4(d.to.x, d.to.y, d.to.z, pose.matrix)
    return { ...d, from, to, width: d.width * s }
  }
  const at = applyMatrix4(d.x, d.y, d.z, pose.matrix)
  // the rotation: the pose's, then the collider's own (its `rot`, or its `yaw`; three's setFromAxisAngle about +Y)
  let turn: { yaw?: number; rot?: Quat }
  if (pose.upright)
    turn =
      d.rot === undefined
        ? d.yaw === undefined
          ? {}
          : { yaw: d.yaw }
        : { rot: d.rot }
  else {
    let own: Quat
    if (d.rot !== undefined)
      own = { x: d.rot.x, y: d.rot.y, z: d.rot.z, w: d.rot.w }
    else {
      const halfAngle = (d.yaw ?? 0) / 2,
        sin = Math.sin(halfAngle)
      own = { x: 0 * sin, y: 1 * sin, z: 0 * sin, w: Math.cos(halfAngle) }
    }
    const q = multiplyQuaternions(pose.quat, own)
    turn =
      Math.abs(q.x) < 1e-9 && Math.abs(q.z) < 1e-9
        ? { yaw: 2 * Math.atan2(q.y, q.w) }
        : { rot: { x: q.x, y: q.y, z: q.z, w: q.w } }
  }
  const surface = d.surface === undefined ? {} : { surface: d.surface }
  switch (d.kind) {
    case 'box':
      return {
        kind: 'box',
        ...at,
        hx: d.hx * s,
        hy: d.hy * s,
        hz: d.hz * s,
        ...turn,
        ...surface,
      }
    case 'capsule':
      return {
        kind: 'capsule',
        ...at,
        halfHeight: d.halfHeight * s,
        radius: d.radius * s,
        ...turn,
        ...surface,
      }
    case 'ball':
      return { kind: 'ball', ...at, radius: d.radius * s, ...turn, ...surface }
    case 'hull':
      return {
        kind: 'hull',
        ...at,
        points: scaled(d.points, s),
        ...turn,
        ...surface,
      }
    case 'trimesh':
      return {
        kind: 'trimesh',
        ...at,
        vertices: scaled(d.vertices, s),
        indices: d.indices,
        ...turn,
        ...surface,
      }
    default:
      return d
  }
}
