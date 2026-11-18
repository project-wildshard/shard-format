import { fields, items, listOf, own, parsedJsonFits } from './parsed-json.ts'
import { parseWorldScenePlacementPage } from './worldScenePlacement.ts'

import type { Check, Fields } from './parsed-json.ts'
import type { WorldScenePlacementPage } from './worldScenePlacement.ts'

// MG10 / ENGINE-MEMORY EM17: a placement page read straight from its text.
// Nine's boot allocated about 110 MB parsing 6 MB of pages: the JSON guard's
// property descriptors, entry and item copies, valibot's rebuilt output and
// the failed branch of the pose union. A value fresh from `JSON.parse` is plain
// data by construction (own enumerable data properties, ordinary prototypes,
// dense arrays, no symbols, accessors or cycles), so the guard reduces to its
// node and depth bounds and canonical numbers. A page whose every object,
// tuple and record matches the schema exactly is already what valibot would
// rebuild, so it is admitted as it stands. Anything else takes
// `parseWorldScenePlacementPage`, which stays the contract and the only source
// of refusals: this path never admits a page that one refuses (the
// differential fuzz in the test).

type Entries = readonly (readonly [string, Check])[]

const NONE = 0
const ONE = 1
const COORD_LIMIT = 1e6
const ID_MAX = 256
const ROWS_MAX = 16
const POSES_MAX = 8192
const BOXES_MAX = 49_152
const BOX_STRIDE = 6
const COLLIDERS_MAX = 32_768
const FLOORS_MAX = 4096
const KNOTS_MIN = 2
const KNOTS_MAX = 8
const SPLIT_MAX = 2048
const PAIR = 2
const TRIPLE = 3
const MATRIX = 16

const has = (value: object, key: string): boolean => Object.hasOwn(value, key)
const poseFits = (pose: unknown): boolean => parsedJsonFits(pose)

/** `placementPageData`'s verdict for a `JSON.parse` value. */
function parsedPageData(page: unknown): boolean {
  const rows = fields(page) ? items(own(page, 'rows')) : undefined
  if (rows === undefined || rows.length > ROWS_MAX) {
    return false
  }
  if (rows.length !== ONE) {
    return parsedJsonFits(page)
  }
  const [row] = rows
  return (
    parsedJsonFits(page, 'rows') &&
    fields(row) &&
    parsedJsonFits(row, 'poses') &&
    listOf(own(row, 'poses'), POSES_MAX, poseFits)
  )
}

const idOk = (value: unknown): boolean =>
  typeof value === 'string' && value.length > NONE && value.length <= ID_MAX
const finiteOk = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= -COORD_LIMIT &&
  value <= COORD_LIMIT
const distanceOk = (value: unknown): boolean => finiteOk(value) && value >= NONE
const boolOk = (value: unknown): boolean => typeof value === 'boolean'
const finites = (value: unknown, length: number): value is readonly number[] =>
  Array.isArray(value) &&
  value.length === length &&
  listOf(value, length, finiteOk)
const pairOk = (value: unknown): boolean => finites(value, PAIR)
const tripleOk = (value: unknown): boolean => finites(value, TRIPLE)
const matrixOk = (value: unknown): boolean => finites(value, MATRIX)
const oneOf =
  (...options: readonly unknown[]): Check =>
  (value: unknown): boolean =>
    options.includes(value)

/** Every key of `value`, inherited enumerable ones too (valibot's strict check reads them), is known. */
function keysWithin(value: Fields, known: ReadonlySet<string>): boolean {
  for (const key in value) {
    if (!known.has(key)) {
      return false
    }
  }
  return true
}
/** Absent, or own and passing: an inherited value would be rebuilt as own. */
const optional = (value: Fields, key: string, check: Check): boolean =>
  !(key in value) || (has(value, key) && check(value[key]))
function allPass(value: Fields, entries: Entries, need: boolean): boolean {
  for (const [key, check] of entries) {
    if (
      need
        ? !has(value, key) || !check(value[key])
        : !optional(value, key, check)
    ) {
      return false
    }
  }
  return true
}
/** A strict object of `need` and `may` fields, its key lists built once. */
function strictShape(
  need: Readonly<Record<string, Check>>,
  may: Readonly<Record<string, Check>>,
): Check {
  const known = new Set([...Object.keys(need), ...Object.keys(may)])
  const needed: Entries = Object.entries(need)
  const allowed: Entries = Object.entries(may)
  return (value: unknown): boolean =>
    fields(value) &&
    keysWithin(value, known) &&
    allPass(value, needed, true) &&
    allPass(value, allowed, false)
}

// Valibot's record drops these keys from its output.
const DROPPED = new Set(['__proto__', 'prototype', 'constructor'])
function paramsOk(value: unknown): boolean {
  if (!fields(value)) {
    return false
  }
  for (const key in value) {
    if (!has(value, key) || DROPPED.has(key) || !idOk(key)) {
      return false
    }
  }
  return true
}
const AXES = ['x', 'y', 'z'] as const
const axes = (
  ...more: readonly (readonly [string, Check])[]
): Record<string, Check> =>
  Object.fromEntries([
    ...AXES.map((axis): [string, Check] => [axis, finiteOk]),
    ...more,
  ])
const yxzOk = strictShape(
  { scale: finiteOk, yaw: finiteOk },
  { pitch: finiteOk, roll: finiteOk, yawAtan2: pairOk },
)
const POSE_MAY = { color: tripleOk, params: paramsOk, variant: idOk }
const matrixPoseOk = strictShape(axes(['matrix', matrixOk]), POSE_MAY)
const yxzPoseOk = strictShape(axes(['yxz', yxzOk]), POSE_MAY)
// The schema's pose union: one of its two strict objects, never both.
function poseOk(value: unknown): boolean {
  if (!fields(value)) {
    return false
  }
  const matrix = has(value, 'matrix')
  if (matrix === has(value, 'yxz')) {
    return false
  }
  return matrix ? matrixPoseOk(value) : yxzPoseOk(value)
}
const tierPairOk = strictShape({ desktop: distanceOk, phone: distanceOk }, {})
const tierNumberOk = (value: unknown): boolean =>
  distanceOk(value) || tierPairOk(value)
const cullOk = strictShape(
  {},
  {
    bounds: oneOf('sphere', 'box'),
    far: tierNumberOk,
    flat: boolOk,
    from: oneOf('origin', 'bounds'),
    frustum: boolOk,
    keepNear: finiteOk,
    lodBy: oneOf('copy', 'set'),
    minAngular: tierNumberOk,
    radiusBias: finiteOk,
    step: distanceOk,
    view: oneOf('forest'),
  },
)
const boxesOk = (value: unknown): boolean =>
  listOf(value, BOXES_MAX, finiteOk) &&
  Array.isArray(value) &&
  value.length % BOX_STRIDE === NONE
const drawnIntoOk = strictShape({ boxes: boxesOk, part: idOk }, {})
// Knots rise strictly along their first value; heights are distances.
function knotOk(knot: unknown): boolean {
  if (!finites(knot, TRIPLE)) {
    return false
  }
  const [, height] = knot
  return distanceOk(height)
}
function rises(knots: readonly unknown[]): boolean {
  let before = Number.NEGATIVE_INFINITY
  for (const knot of knots) {
    const [along = Number.NaN] = finites(knot, TRIPLE) ? knot : []
    if (!(along > before)) {
      return false
    }
    before = along
  }
  return true
}
function profileOk(value: unknown): boolean {
  const knots = items(value)
  return (
    knots !== undefined &&
    knots.length >= KNOTS_MIN &&
    listOf(knots, KNOTS_MAX, knotOk) &&
    rises(knots)
  )
}
const floorOk = strictShape(
  { ...axes(), hd: distanceOk, hw: distanceOk },
  { profile: profileOk, rot: finiteOk, slope: finiteOk, tilt: finiteOk },
)
const splitOk = (value: unknown): boolean =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= ONE &&
  value <= SPLIT_MAX
const pieceOk = strictShape(
  { id: idOk },
  {
    floorPolicy: oneOf('first', 'highest'),
    floors: (value: unknown): boolean => listOf(value, FLOORS_MAX, floorOk),
    follows: oneOf('copy'),
    name: idOk,
    solidFloor: boolOk,
    split: splitOk,
  },
)
const rowOk = strictShape(
  {
    draw: oneOf('single', 'instanced', 'batched', 'merged'),
    id: idOk,
    model: idOk,
    poses: (value: unknown): boolean => listOf(value, POSES_MAX, poseOk),
  },
  {
    batch: idOk,
    colliders: (value: unknown): boolean =>
      Array.isArray(value) && value.length <= COLLIDERS_MAX,
    cull: cullOk,
    drawnInto: drawnIntoOk,
    name: idOk,
    piece: pieceOk,
    sortObjects: boolOk,
    tier: oneOf('phone', 'desktop'),
  },
)
const rowId = (row: unknown): unknown => (fields(row) ? own(row, 'id') : row)
const rowsOk = (value: unknown): boolean =>
  listOf(value, ROWS_MAX, rowOk) &&
  Array.isArray(value) &&
  value.length > NONE &&
  new Set(value.map((row: unknown): unknown => rowId(row))).size ===
    value.length
const pageShapeOk = strictShape({ rows: rowsOk, version: oneOf(ONE) }, {})

/**
 * True when `value`, fresh from `JSON.parse`, is a placement page
 * `parseWorldScenePlacementPage` admits and would rebuild unchanged (key order
 * aside). False is no verdict: the caller asks the schema. Only for
 * `JSON.parse` output; another value may carry accessors or prototypes.
 */
function plainPlacementPage(value: unknown): value is WorldScenePlacementPage {
  return parsedPageData(value) && pageShapeOk(value)
}

/**
 * A placement page from its JSON text, as the client reads it: admitted as it
 * stands when it is plain and exact, otherwise through
 * `parseWorldScenePlacementPage` (its output, or its refusal).
 */
function parseWorldScenePlacementPageText(
  text: string,
): WorldScenePlacementPage {
  const value: unknown = JSON.parse(text)
  return plainPlacementPage(value) ? value : parseWorldScenePlacementPage(value)
}

export { parseWorldScenePlacementPageText, plainPlacementPage }
