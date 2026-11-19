/* oxlint-disable id-length -- The collision and GLB wire contracts use x, y, z, w and half extents. */
import { CELL_ABOVE, CELL_BELOW } from './contentBounds.ts'
import { glbPoint, glbTransform } from './glbTriangles.ts'

import type { GlbVertex } from './glbTriangles.ts'

type HullPose = Readonly<GlbVertex> & {
  readonly points: readonly number[]
  readonly yaw?: number | undefined
  readonly rot?: (Readonly<GlbVertex> & { readonly w: number }) | undefined
}
type HullBounds = GlbVertex & {
  readonly kind: 'box'
  readonly hx: number
  readonly hy: number
  readonly hz: number
}

const CELL_HALF_WIDTH = 250
const DIAMETER = 2
const ZERO = 0
const CELL_WIDTH = CELL_HALF_WIDTH * DIAMETER
const LOCAL_LIMIT = Math.hypot(CELL_WIDTH, CELL_ABOVE + CELL_BELOW, CELL_WIDTH)
const COMPONENTS = 3
const MIN_VERTICES = 4
const PLANE_EPSILON = 1e-5

function pointsInWorld(shape: HullPose): GlbVertex[] {
  const halfYaw = (shape.yaw ?? ZERO) / DIAMETER
  const rotation = shape.rot ?? {
    x: 0,
    y: Math.sin(halfYaw),
    z: 0,
    w: Math.cos(halfYaw),
  }
  const matrix = glbTransform({
    translation: [shape.x, shape.y, shape.z],
    rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
  })
  const result: GlbVertex[] = []
  for (let index = 0; index < shape.points.length; index += COMPONENTS) {
    const [localX, localY, localZ] = shape.points.slice(
      index,
      index + COMPONENTS,
    )
    if (localX === undefined || localY === undefined || localZ === undefined) {
      return []
    }
    result.push(
      glbPoint(matrix, {
        x: Math.fround(localX),
        y: Math.fround(localY),
        z: Math.fround(localZ),
      }),
    )
  }
  return result
}

function insideCell(vertex: Readonly<GlbVertex>): boolean {
  return (
    Math.abs(vertex.x) <= CELL_HALF_WIDTH &&
    Math.abs(vertex.z) <= CELL_HALF_WIDTH &&
    vertex.y >= -CELL_BELOW &&
    vertex.y <= CELL_ABOVE
  )
}

function longest(points: readonly Readonly<GlbVertex>[]): Readonly<GlbVertex> {
  let vector = { x: 0, y: 0, z: 0 }
  let maxLength = 0
  for (const point of points) {
    const length = point.x * point.x + point.y * point.y + point.z * point.z
    if (length > maxLength) {
      maxLength = length
      vector = point
    }
  }
  return vector
}

function hasVolume(
  vertices: readonly Readonly<GlbVertex>[],
  first: Readonly<GlbVertex>,
): boolean {
  const offsets = vertices.map((point: Readonly<GlbVertex>): GlbVertex => ({
    x: point.x - first.x,
    y: point.y - first.y,
    z: point.z - first.z,
  }))
  const axis = longest(offsets)
  const normal = longest(
    offsets.map((point: Readonly<GlbVertex>): GlbVertex => ({
      x: axis.y * point.z - axis.z * point.y,
      y: axis.z * point.x - axis.x * point.z,
      z: axis.x * point.y - axis.y * point.x,
    })),
  )
  const length = Math.hypot(normal.x, normal.y, normal.z)
  return (
    length > ZERO &&
    offsets.some(
      (point: Readonly<GlbVertex>): boolean =>
        Math.abs(normal.x * point.x + normal.y * point.y + normal.z * point.z) >
        PLANE_EPSILON * length,
    )
  )
}

/** Require volume after rounding the local vertices to Rapier's float32 coordinates. */
function solidHullWithinCell(shape: HullPose): boolean {
  const { points } = shape
  if (
    points.length < MIN_VERTICES * COMPONENTS ||
    points.length % COMPONENTS !== ZERO ||
    !points.every((value): boolean => Math.abs(value) <= LOCAL_LIMIT)
  ) {
    return false
  }
  const posed = pointsInWorld(shape)
  const [first] = posed
  if (
    first === undefined ||
    !posed.every((vertex: Readonly<GlbVertex>): boolean => insideCell(vertex))
  ) {
    return false
  }
  return hasVolume(posed, first)
}

function axisBounds(values: readonly number[]): readonly [number, number] {
  return [Math.min(...values), Math.max(...values)]
}

/** A conservative clearance envelope for the posed convex solid. */
function propHullBounds(shape: HullPose): HullBounds {
  const points = pointsInWorld(shape)
  const [minX, maxX] = axisBounds(
    points.map((point: Readonly<GlbVertex>): number => point.x),
  )
  const [minY, maxY] = axisBounds(
    points.map((point: Readonly<GlbVertex>): number => point.y),
  )
  const [minZ, maxZ] = axisBounds(
    points.map((point: Readonly<GlbVertex>): number => point.z),
  )
  return {
    kind: 'box',
    x: (minX + maxX) / DIAMETER,
    y: (minY + maxY) / DIAMETER,
    z: (minZ + maxZ) / DIAMETER,
    hx: (maxX - minX) / DIAMETER,
    hy: (maxY - minY) / DIAMETER,
    hz: (maxZ - minZ) / DIAMETER,
  }
}

type CapsulePose = Readonly<GlbVertex> & {
  readonly halfHeight: number
  readonly radius: number
  readonly yaw?: number | undefined
  readonly rot?: (Readonly<GlbVertex> & { readonly w: number }) | undefined
}
const BELOW = -1
const ABOVE = 1
const SIGNS = [BELOW, ABOVE] as const

/** OF22a3: a capsule's local bounding box corners, posed as the capsule is. */
function capsuleCorners(shape: CapsulePose): number[] {
  const across = shape.radius
  const along = shape.halfHeight + shape.radius
  return SIGNS.flatMap((sx: number): number[] =>
    SIGNS.flatMap((sy: number): number[] =>
      SIGNS.flatMap((sz: number): number[] => [
        sx * across,
        sy * along,
        sz * across,
      ]),
    ),
  )
}

/** A conservative clearance envelope for the posed capsule. */
function propCapsuleBounds(shape: CapsulePose): HullBounds {
  return propHullBounds({ ...shape, points: capsuleCorners(shape) })
}

/** OF22a3: both posed end caps, swollen by the radius, stay inside the cell. */
function solidCapsuleWithinCell(shape: CapsulePose): boolean {
  const ends = pointsInWorld({
    ...shape,
    points: [ZERO, -shape.halfHeight, ZERO, ZERO, shape.halfHeight, ZERO],
  })
  return (
    ends.length === SIGNS.length &&
    ends.every(
      (end: Readonly<GlbVertex>): boolean =>
        Math.abs(end.x) + shape.radius <= CELL_HALF_WIDTH &&
        Math.abs(end.z) + shape.radius <= CELL_HALF_WIDTH &&
        end.y - shape.radius >= -CELL_BELOW &&
        end.y + shape.radius <= CELL_ABOVE,
    )
  )
}

export {
  propCapsuleBounds,
  propHullBounds,
  solidCapsuleWithinCell,
  solidHullWithinCell,
}
