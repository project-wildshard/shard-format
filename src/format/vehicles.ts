// oxlint-disable typescript/prefer-readonly-parameter-types, eslint/max-lines -- valibot's output rows have mutable types and nothing here writes them; the section's types, schema and rules read as one
/**
 * `world/vehicles` (meta MIRROR-SALT-ZONE MSZ1, J456, J459 call 1 A): the one way a shard declares vehicles a player gets
 * into, sits in, drives and leaves. A **kind** is the vehicle: the panel every page poses, its seats, hull, handling,
 * health and sounds. A **dock** is where one stands and comes back. Metres, seconds and radians throughout; a kind's
 * points are in its own frame (x right, y up, z back, so forward is -z, as a steer carry's), a dock's in the cell's.
 *
 * Plain data and checks, no three.js.
 */
import {
  boolean,
  check,
  exactOptional,
  finite,
  literal,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  parse,
  picklist,
  pipe,
  regex,
  string,
  strictObject,
  tuple,
  union,
  array,
} from 'valibot'

import { WIRE_CELL } from './wireLimits.ts'

import type { GenericSchema } from 'valibot'

/** A point or extent: x, y and z. */
type Vec3 = [number, number, number]
/** One seat: who sits there, where (the body's base, in the kind's frame), how, and where leaving sets them down. */
interface VehicleSeat {
  role: 'driver' | 'passenger'
  at: Vec3
  pose: 'sit' | 'stand'
  leave: Vec3
}
/** One hull box in the kind's frame: its centre, half extents and turn about up. It rides the vehicle and stops anyone on foot, never a rider. */
interface VehicleHullBox {
  at: Vec3
  half: Vec3
  yaw?: number
}
/** SS-MS2a2's sail push: the ground direction the wind blows toward (x, z; not zero) and the m/s a full sail adds. */
interface VehicleWind {
  toward: [number, number]
  push: number
}
/**
 * How it drives: top `speed` and `reverse` (m/s), `accel` and `brake` (m/s²), `turn` (rad/s at full stick), `grip` (0
 * slides like ice, 1 never slips), `drift` (0 to 1, how long a slide lasts), `boost` (top speed times 1 to 4), `mass` (kg,
 * who gives way in a crash), `ground` (follow the ground under it, or keep its dock's height) and an optional sail `wind`.
 */
interface VehicleHandling {
  speed: number
  reverse: number
  accel: number
  brake: number
  turn: number
  grip: number
  drift: number
  boost: number
  mass: number
  ground: boolean
  wind?: VehicleWind
}
/** Audio cue ids (`audio.cues`) a kind plays: the engine loop, a skid from slip, an impact one-shot and a horn. */
interface VehicleSounds {
  loop?: string
  skid?: string
  impact?: string
  horn?: string
}
/** The prompt labels: get in as the driver, get in as a passenger, get out. */
interface VehicleLabels {
  drive?: string
  ride?: string
  leave?: string
}
/** One vehicle kind. */
interface VehicleKind {
  id: string
  panel: string
  labels?: VehicleLabels
  seats: VehicleSeat[]
  hull: VehicleHullBox[]
  handling: VehicleHandling
  health?: number
  sounds?: VehicleSounds
}
/** Where a kind stands: one per player who comes (`player`) or one everyone shares (`shared`); back `respawn` s after it goes. */
interface VehicleDock {
  id: string
  kind: string
  at: Vec3
  yaw: number
  per: 'player' | 'shared'
  respawn: number
}
/** The `world/vehicles` section. */
interface Vehicles {
  kinds: VehicleKind[]
  docks: VehicleDock[]
}
type VehiclesInput = Vehicles
/** What a kind's references must find in the rest of the shard file. */
interface VehicleReferences {
  readonly props: { readonly panels: readonly { readonly id: string }[] } | null
  readonly audio: { readonly cues: readonly { readonly id: string }[] }
  readonly movers: readonly { readonly id: string }[]
}

// MSZ1's bounds: kinds and docks a shard; seats and hull boxes a kind; metres, m/s, m/s², kg, seconds and characters.
const MAX_KINDS = 8
const MAX_DOCKS = 32
const MAX_SEATS = 4
const MAX_HULL_BOXES = 16
const MAX_HULL_HALF = 8
const KIND_REACH = 16
const SEAT_REACH = 10
const MAX_SPEED = 60
const MAX_ACCEL = 100
const MAX_BRAKE = 200
const MAX_TURN = Math.PI + Math.PI
const MAX_BOOST = 4
const MAX_PUSH = 20
const MAX_MASS = 50_000
const MAX_HEALTH = 100_000
const MAX_RESPAWN = 3600
const LEAST = 0.005
const MAX_TEXT = 128
const SOUND_SLOTS: readonly (keyof VehicleSounds)[] = [
  'loop',
  'skid',
  'impact',
  'horn',
]
const NONE = 0
const ONE = 1
const ID = /^[a-z][a-z0-9.-]*$/u

/** A finite number from `low` to `high`. */
function bounded(low: number, high: number): GenericSchema<number> {
  return pipe(number(), finite(), minValue(low), maxValue(high))
}
/** A point each of whose axes is within `reach` of the origin. */
function near(reach: number): GenericSchema<Vec3> {
  const axis = bounded(-reach, reach)
  return tuple([axis, axis, axis])
}
/** Whether no two ids are the same. */
function distinct(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length
}
/** Whether no two kinds share an id. */
function kindIdsUnique(rows: VehicleKind[]): boolean {
  return distinct(rows.map((row: VehicleKind): string => row.id))
}
/** Whether no two docks share an id. */
function dockIdsUnique(rows: VehicleDock[]): boolean {
  return distinct(rows.map((row: VehicleDock): string => row.id))
}
/** Whether a seat is the driver's. */
function isDriver(row: VehicleSeat): boolean {
  return row.role === 'driver'
}
/** Whether a kind has exactly one driver seat. */
function oneDriver(rows: VehicleSeat[]): boolean {
  return (
    rows.filter((row: VehicleSeat): boolean => isDriver(row)).length === ONE
  )
}
/** Whether a sail's push names a direction. */
function blowsSomewhere(toward: [number, number]): boolean {
  return toward.some((axis: number): boolean => axis !== NONE)
}
/** Whether it reverses no faster than its top speed. */
function reverseWithin(row: VehicleHandling): boolean {
  return row.reverse <= row.speed
}
/** Whether every dock names a declared kind. */
function docksOfKinds(row: Vehicles): boolean {
  const kinds = new Set(row.kinds.map((kind: VehicleKind): string => kind.id))
  return row.docks.every((dock: VehicleDock): boolean => kinds.has(dock.kind))
}

const id = pipe(string(), regex(ID), maxLength(MAX_TEXT))
const text = pipe(string(), minLength(ONE), maxLength(MAX_TEXT))
const anyNumber = pipe(number(), finite())
const angle = bounded(-Math.PI, Math.PI)
const half = bounded(LEAST, MAX_HULL_HALF)
const cellAxis = bounded(-WIRE_CELL.half, WIRE_CELL.half)
const cellHeight = bounded(-WIRE_CELL.below, WIRE_CELL.above)
const seat = strictObject({
  role: picklist(['driver', 'passenger']),
  at: near(SEAT_REACH),
  pose: picklist(['sit', 'stand']),
  leave: near(KIND_REACH),
})
const hullBox = strictObject({
  at: near(KIND_REACH),
  half: tuple([half, half, half]),
  yaw: exactOptional(angle),
})
const wind = strictObject({
  toward: pipe(
    tuple([anyNumber, anyNumber]),
    check(blowsSomewhere, 'a wind push needs a direction'),
  ),
  push: bounded(NONE, MAX_PUSH),
})
const handling = pipe(
  strictObject({
    speed: bounded(LEAST, MAX_SPEED),
    reverse: bounded(NONE, MAX_SPEED),
    accel: bounded(LEAST, MAX_ACCEL),
    brake: bounded(LEAST, MAX_BRAKE),
    turn: bounded(LEAST, MAX_TURN),
    grip: bounded(NONE, ONE),
    drift: bounded(NONE, ONE),
    boost: bounded(ONE, MAX_BOOST),
    mass: bounded(ONE, MAX_MASS),
    ground: boolean(),
    wind: exactOptional(wind),
  }),
  check(reverseWithin, 'a vehicle reverses no faster than its top speed'),
)
const cue = pipe(string(), minLength(ONE), maxLength(MAX_TEXT))
const sounds = strictObject({
  loop: exactOptional(cue),
  skid: exactOptional(cue),
  impact: exactOptional(cue),
  horn: exactOptional(cue),
})
const labels = strictObject({
  drive: exactOptional(text),
  ride: exactOptional(text),
  leave: exactOptional(text),
})
const seats = pipe(
  array(seat),
  minLength(ONE, 'a vehicle kind has at least one seat'),
  maxLength(MAX_SEATS, `a vehicle kind has at most ${String(MAX_SEATS)} seats`),
  check(oneDriver, 'a vehicle kind has exactly one driver seat'),
)
const hull = pipe(
  array(hullBox),
  maxLength(
    MAX_HULL_BOXES,
    `a vehicle hull has at most ${String(MAX_HULL_BOXES)} boxes`,
  ),
)
const kind = strictObject({
  id,
  panel: id,
  labels: exactOptional(labels),
  seats,
  hull,
  handling,
  health: exactOptional(bounded(ONE, MAX_HEALTH)),
  sounds: exactOptional(sounds),
})
const dock = strictObject({
  id,
  kind: id,
  at: tuple([cellAxis, cellHeight, cellAxis]),
  yaw: angle,
  per: union([literal('player'), literal('shared')]),
  respawn: bounded(NONE, MAX_RESPAWN),
})
const kinds = pipe(
  array(kind),
  maxLength(
    MAX_KINDS,
    `a shard has at most ${String(MAX_KINDS)} vehicle kinds`,
  ),
  check(kindIdsUnique, 'vehicle kind ids are unique'),
)
const docks = pipe(
  array(dock),
  maxLength(
    MAX_DOCKS,
    `a shard has at most ${String(MAX_DOCKS)} vehicle docks`,
  ),
  check(dockIdsUnique, 'vehicle dock ids are unique'),
)

/** The `world/vehicles` section (MSZ1): unique ids, docks of declared kinds, at most 8 kinds and 32 docks. */
const VehiclesSchema: GenericSchema<VehiclesInput, Vehicles> = pipe(
  strictObject({ kinds, docks }),
  check(docksOfKinds, 'a vehicle dock names a declared kind'),
)

/** Refuse a malformed `world/vehicles` section, naming the bound it breaks. */
function parseVehicles(input: unknown): Vehicles {
  return parse(VehiclesSchema, input)
}

/** Why one kind's panel or sounds do not resolve. */
function kindRules(
  row: VehicleKind,
  panels: ReadonlySet<string>,
  cues: ReadonlySet<string>,
): string[] {
  const errors: string[] = []
  if (!panels.has(row.panel)) {
    errors.push(
      `vehicle kind ${row.id} names the panel ${row.panel}, which props.panels does not declare`,
    )
  }
  for (const slot of SOUND_SLOTS) {
    const name = row.sounds?.[slot]
    if (name !== undefined && !cues.has(name)) {
      errors.push(
        `vehicle kind ${row.id}'s ${slot} sound ${name} is not a declared audio cue`,
      )
    }
  }
  return errors
}

/** Each kind's panel is a declared prop panel, each sound a declared audio cue, and no dock reuses a mover's id. */
function vehicleRules(vehicles: Vehicles, source: VehicleReferences): string[] {
  const panels = new Set(
    source.props?.panels.map((row: { readonly id: string }): string => row.id),
  )
  const cues = new Set(
    source.audio.cues.map((row: { readonly id: string }): string => row.id),
  )
  const movers = new Set(
    source.movers.map((row: { readonly id: string }): string => row.id),
  )
  const kindErrors = vehicles.kinds.flatMap((row: VehicleKind): string[] =>
    kindRules(row, panels, cues),
  )
  const dockErrors = vehicles.docks
    .filter((row: VehicleDock): boolean => movers.has(row.id))
    .map(
      (row: VehicleDock): string => `vehicle dock ${row.id} has a mover's id`,
    )
  return [...kindErrors, ...dockErrors]
}

export { VehiclesSchema, parseVehicles, vehicleRules }
export type {
  VehicleDock,
  VehicleHandling,
  VehicleHullBox,
  VehicleKind,
  VehicleLabels,
  VehicleReferences,
  VehicleSeat,
  VehicleSounds,
  VehicleWind,
  Vehicles,
  VehiclesInput,
}
