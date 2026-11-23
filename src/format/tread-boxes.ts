/* oxlint-disable id-length, import/group-exports, max-statements, no-magic-numbers, no-plusplus -- a port of engine's treadBoxes kept term for term (SHARD-COMPAT PR6b), so the boxes match engine's byte for byte */
// SHARD-COMPAT PR6b (J487): a stair's `treads` collider as the solid boxes physics installs, one per tread from the
// stair's foot up to that tread's top, with format code only. Moved from engine
// `src/shared/engine/physics/pieces.ts` `treadBoxes`; the material (surface, friction, groups) rides on every box.

interface Point {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** A `treads` shape as props declare it, with whatever contact fields it carries. */
export interface TreadShape {
  readonly from: Point
  readonly to: Point
  readonly width: number
  readonly count: number
  readonly surface?: string
  readonly friction?: number
  readonly groups?: number
}

/** One tread's solid block: centre, half extents and yaw, plus the stair's material. */
export interface TreadBox {
  readonly kind: 'box'
  readonly x: number
  readonly y: number
  readonly z: number
  readonly hx: number
  readonly hy: number
  readonly hz: number
  readonly yaw: number
  readonly surface?: string
  readonly friction?: number
  readonly groups?: number
}

/** One tread of a stair: a solid block from the stair's foot up to this tread's top. */
export function treadBoxes(d: TreadShape): TreadBox[] {
  const dx = d.to.x - d.from.x
  const dz = d.to.z - d.from.z
  const run = Math.hypot(dx, dz) / d.count
  const rise = (d.to.y - d.from.y) / d.count
  const yaw = Math.atan2(dx, dz)
  const out: TreadBox[] = []
  for (let i = 0; i < d.count; i++) {
    const f = (i + 0.5) / d.count
    const top = d.from.y + rise * (i + 1)
    const hy = Math.max(0.01, (top - d.from.y) / 2)
    out.push({
      kind: 'box',
      x: d.from.x + dx * f,
      y: d.from.y + hy,
      z: d.from.z + dz * f,
      hx: d.width / 2,
      hy,
      hz: run / 2,
      yaw,
      ...(d.surface === undefined ? {} : { surface: d.surface }),
      ...(d.friction === undefined ? {} : { friction: d.friction }),
      ...(d.groups === undefined ? {} : { groups: d.groups }),
    })
  }
  return out
}
