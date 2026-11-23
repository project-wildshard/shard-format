/* oxlint-disable capitalized-comments, id-length, max-lines-per-function, no-continue, no-implicit-coercion, no-magic-numbers, oxc/erasing-op, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/prefer-modern-math-apis -- three.js 0.186's Quaternion and Vector3 steps ported term for term (SHARD-COMPAT PR6b), so the hulls match engine's byte for byte */
// SHARD-COMPAT PR6b (J487): each steer vehicle's hull as boxes in its own frame, from the shard's movers and prop
// colliders with format code only, so the MMO server builds vehicle bodies without engine code. Moved from engine
// `src/shared/game/shardfile/vehicleHulls.ts` (SHARD-SOURCE SS-GP5). The format keeps a carry `channel` row box-free,
// so a vehicle's solids are its panel's collider rows (`props.colliders` whose `panel` is the vehicle's id), written in
// the cell's frame at its rest; here they turn into the vehicle's frame (about its rest, YXZ). A tread shape is no
// hull; at most 128 boxes, as a mover holds.
import type { MoverBox } from './mover-pose.ts'
import type { Shardfile } from './shardSchema.ts'

const MAX_BOXES = 128

/** A quaternion as x, y, z, w. */
type Quat = readonly [number, number, number, number]

/** three's `setFromEuler` for order YXZ. */
function fromEulerYXZ(x: number, y: number, z: number): Quat {
  const c1 = Math.cos(x / 2)
  const c2 = Math.cos(y / 2)
  const c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2)
  const s2 = Math.sin(y / 2)
  const s3 = Math.sin(z / 2)
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 - s1 * s2 * c3,
    c1 * c2 * c3 + s1 * s2 * s3,
  ]
}

/** three's `multiplyQuaternions(a, b)`. */
function multiply(a: Quat, b: Quat): Quat {
  const [qax, qay, qaz, qaw] = a
  const [qbx, qby, qbz, qbw] = b
  return [
    qax * qbw + qaw * qbx + qay * qbz - qaz * qby,
    qay * qbw + qaw * qby + qaz * qbx - qax * qbz,
    qaz * qbw + qaw * qbz + qax * qby - qay * qbx,
    qaw * qbw - qax * qbx - qay * qby - qaz * qbz,
  ]
}

/** three's `normalize`: a zero quaternion becomes the identity. */
function normalize(q: Quat): Quat {
  const [x, y, z, w] = q
  const length = Math.sqrt(x * x + y * y + z * z + w * w)
  if (length === 0) {
    return [0, 0, 0, 1]
  }
  const inverse = 1 / length
  return [x * inverse, y * inverse, z * inverse, w * inverse]
}

/** three's `Vector3.applyQuaternion`. */
function rotate(
  v: readonly [number, number, number],
  q: Quat,
): readonly [number, number, number] {
  const [vx, vy, vz] = v
  const [qx, qy, qz, qw] = q
  const tx = 2 * (qy * vz - qz * vy)
  const ty = 2 * (qz * vx - qx * vz)
  const tz = 2 * (qx * vy - qy * vx)
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ]
}

/** Each steer vehicle's hull, as boxes in its own frame (about its rest, YXZ), by mover id. */
export function vehicleHulls(
  source: Pick<Shardfile, 'movers'> & Partial<Pick<Shardfile, 'props'>>,
): ReadonlyMap<string, readonly MoverBox[]> {
  const hulls = new Map<string, readonly MoverBox[]>()
  for (const row of source.movers) {
    if (row.kind !== 'channel' || row.driver?.kind !== 'steer') {
      continue
    }
    const [ex, ey, ez, ew] = fromEulerYXZ(row.euler.x, row.euler.y, row.euler.z)
    // three's `invert` of a unit quaternion is its conjugate.
    const back: Quat = [-ex, -ey, -ez, ew]
    const boxes = (source.props?.colliders ?? [])
      .filter(solid => solid.panel === row.id)
      .flatMap(solid => solid.shapes)
      .flatMap((shape): MoverBox[] => {
        if (shape.kind !== 'box') {
          return []
        }
        const [x, y, z] = rotate(
          [shape.x - row.at.x, shape.y - row.at.y, shape.z - row.at.z],
          back,
        )
        const half = (shape.yaw ?? 0) / 2
        const turn: Quat =
          shape.rot === undefined
            ? [
                0 * Math.sin(half),
                1 * Math.sin(half),
                0 * Math.sin(half),
                Math.cos(half),
              ]
            : [shape.rot.x, shape.rot.y, shape.rot.z, shape.rot.w]
        const [rx, ry, rz, rw] = normalize(multiply(back, turn))
        return [
          {
            x,
            y,
            z,
            hx: shape.hx,
            hy: shape.hy,
            hz: shape.hz,
            rot: { x: rx, y: ry, z: rz, w: rw },
          },
        ]
      })
      .slice(0, MAX_BOXES)
    if (boxes.length > 0) {
      hulls.set(row.id, boxes)
    }
  }
  return hulls
}
