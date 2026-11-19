// oxlint-disable typescript/prefer-readonly-parameter-types, id-length, no-magic-numbers, max-statements, max-lines, max-lines-per-function -- valibot's output rows have mutable types and nothing here writes them; points are x, y, z tuples read by index 0 to 2, and one lift reads as one function
/**
 * MIRROR-SALT-ZONE MSZ2 (meta J459 call 1 A): a steer carry becomes a vehicle, and back.
 *
 * `liftSteerVehicles` is the migration: each native carry `channel` mover with a `steer` driver (SS-MS2a1) becomes one
 * `world/vehicles` kind (one driver seat at the carry's seat, the carry's prompts as its labels, its panel's
 * `props.colliders` boxes as its hull, SS-GP5) and one shared dock at its rest, and leaves `movers`. A carry's numbers
 * that a kind has no word for take today's behaviour: no reverse, a brake as quick as its acceleration, full grip and no
 * drift. The `steer` driver row stays readable, for old revisions only.
 *
 * `vehicleCarryMovers` lowers each dock back to the steer carry an engine without the vehicle runtime (MSZ8) runs, with
 * `vehicleCarryHulls` for its hull; a passenger seat has no carry, so it waits for MSZ9.
 *
 * Plain data and checks, no three.js.
 */
import { lowerMoverMotion } from './moverMotion.ts'
import { parseVehicles } from './vehicles.ts'

import type { MoverCarry, MoverMotion } from './moverMotion.ts'
import type { MoverBox, MoverData } from './movers.ts'
import type { Shardfile } from './shardSchema.ts'
import type {
  VehicleDock,
  VehicleHullBox,
  VehicleKind,
  Vehicles,
} from './vehicles.ts'

/** One mover row. */
type MoverRow = MoverData[number]
/** The steer driver row. */
type SteerDriver = Extract<NonNullable<MoverRow['driver']>, { kind: 'steer' }>
/** What a lift reads: the movers, and the props whose panel colliders are a vehicle's hull. */
type LiftSource = Pick<Shardfile, 'movers' | 'props'>
/** What a lift gives: the vehicles, the movers left, and a line for each collider a hull could not take. */
interface Lifted {
  vehicles: Vehicles
  movers: MoverData
  notes: string[]
}

/** The mass a lifted vehicle gets (kg); a carry has none. */
const LIFTED_MASS = 250
/** A lifted shared dock's respawn (s). */
const LIFTED_RESPAWN = 30
const MAX_HULL_BOXES = 16
const MAX_HULL_HALF = 8
const KIND_REACH = 16
const HALF = 0.5
const NONE = 0
const UP = 1
/** A lowered carry's board prompt reaches this far past the hull's widest half (m), and at most this far. */
const BOARD_MARGIN = 2
const BOARD_MOST = 10
/** The leave prompt sits this far over the seat (m) and reaches this far, as the SDK's steer carry did. */
const LEAVE_RISE = 1.2
const LEAVE_REACH = 2
const DRIVE_LABEL = 'Board'
const LEAVE_LABEL = 'Leave'
const FLAT = {
  level: 0,
  bankRamp: 0,
  bob: [0, 0],
  pitch: [0, 0],
  roll: [0, 0, 0],
} as const satisfies MoverCarry['surface']
const MILLI = 1000

/** Round to a millimetre (or a milliradian), so a lifted row reads as authored. */
function milli(value: number): number {
  return Math.round(value * MILLI) / MILLI
}
/** An angle wrapped into -π to π. */
function wrap(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}
/** Whether a mover row is a steer carry. */
function isSteerCarry(
  row: MoverRow,
): row is MoverRow & { driver: SteerDriver; carry: MoverCarry } {
  return (
    row.execution === 'native' &&
    row.kind === 'channel' &&
    row.driver?.kind === 'steer' &&
    row.carry !== undefined
  )
}

/** One world-space panel collider box as a hull box in the vehicle's frame (its rest and heading), or why it can't be. */
function hullBox(
  shape: {
    x: number
    y: number
    z: number
    hx: number
    hy: number
    hz: number
    yaw?: number | undefined
    rot?: unknown
  },
  row: MoverRow,
): VehicleHullBox | string {
  if (shape.rot !== undefined) {
    return `${row.id}: a turned (rot) collider box is no hull box`
  }
  const halves: [number, number, number] = [shape.hx, shape.hy, shape.hz]
  if (halves.some((half: number): boolean => half > MAX_HULL_HALF)) {
    return `${row.id}: a collider box over ${String(MAX_HULL_HALF)} m is no hull box`
  }
  const heading = row.euler.y
  const dx = shape.x - row.at.x
  const dz = shape.z - row.at.z
  const at: [number, number, number] = [
    milli(dx * Math.cos(heading) - dz * Math.sin(heading)),
    milli(shape.y - row.at.y),
    milli(dx * Math.sin(heading) + dz * Math.cos(heading)),
  ]
  if (at.some((axis: number): boolean => Math.abs(axis) > KIND_REACH)) {
    return `${row.id}: a collider box ${String(KIND_REACH)} m or more from the rest is no hull box`
  }
  const yaw = milli(wrap((shape.yaw ?? NONE) - heading))
  return yaw === NONE ? { at, half: halves } : { at, half: halves, yaw }
}

/** The handling a steer driver means. */
function steerHandling(driver: SteerDriver): VehicleKind['handling'] {
  const { speed, turn, boost, accel, ground, wind } = driver
  const still = {
    speed,
    reverse: NONE,
    accel,
    brake: accel,
    turn,
    grip: UP,
    drift: NONE,
    boost,
    mass: LIFTED_MASS,
    ground,
  }
  return wind === undefined
    ? still
    : {
        ...still,
        wind: { toward: [wind.toward[0], wind.toward[1]], push: wind.push },
      }
}

/** One steer carry as a kind and its shared dock. */
function liftOne(
  row: MoverRow & { driver: SteerDriver; carry: MoverCarry },
  props: LiftSource['props'],
  notes: string[],
): [VehicleKind, VehicleDock] {
  const { carry } = row
  const shapes = (props?.colliders ?? [])
    .filter((solid): boolean => solid.panel === row.id)
    .flatMap(
      (
        solid,
      ): NonNullable<LiftSource['props']>['colliders'][number]['shapes'] =>
        solid.shapes,
    )
  const hull: VehicleHullBox[] = []
  for (const shape of shapes) {
    const box =
      shape.kind === 'box'
        ? hullBox(shape, row)
        : `${row.id}: a ${shape.kind} collider is no hull box`
    if (typeof box === 'string') {
      notes.push(box)
    } else if (hull.length < MAX_HULL_BOXES) {
      hull.push(box)
    } else {
      notes.push(`${row.id}: a hull holds ${String(MAX_HULL_BOXES)} boxes`)
    }
  }
  const [board, leave] = carry.prompts
  const labels = {
    ...(board.label === '' ? {} : { drive: board.label }),
    ...(leave.label === '' ? {} : { leave: leave.label }),
  }
  const kind: VehicleKind = {
    id: row.id,
    panel: row.id,
    ...(Object.keys(labels).length === NONE ? {} : { labels }),
    seats: [
      {
        role: 'driver',
        at: [NONE, carry.seat, NONE],
        pose: 'stand',
        leave: [...carry.landings[0]],
      },
    ],
    hull,
    handling: steerHandling(row.driver),
  }
  const dock: VehicleDock = {
    id: row.id,
    kind: row.id,
    at: [row.at.x, row.at.y, row.at.z],
    yaw: row.euler.y,
    per: 'shared',
    respawn: LIFTED_RESPAWN,
  }
  return [kind, dock]
}

/** MSZ2: every steer carry in `source.movers` as a `world/vehicles` kind and shared dock, and the movers without them. */
function liftSteerVehicles(source: LiftSource): Lifted {
  const notes: string[] = []
  const lifted = source.movers
    .filter(isSteerCarry)
    .map((row): [VehicleKind, VehicleDock] => liftOne(row, source.props, notes))
  const vehicles = parseVehicles({
    kinds: lifted.map(([kind]): VehicleKind => kind),
    docks: lifted.map(([, dock]): VehicleDock => dock),
  })
  return {
    vehicles,
    movers: source.movers.filter((row): boolean => !isSteerCarry(row)),
    notes,
  }
}

/** A kind's driver seat (the schema admits exactly one). */
function driverSeat(kind: VehicleKind): VehicleKind['seats'][number] {
  const seat = kind.seats.find((row): boolean => row.role === 'driver')
  if (seat === undefined) {
    throw new Error(`vehicle kind ${kind.id} has no driver seat`)
  }
  return seat
}

/** One dock as the steer carry today's engine runs (`entity` its mover entity). */
function carryRow(
  dock: VehicleDock,
  kind: VehicleKind,
  entity: number,
): MoverRow {
  const seat = driverSeat(kind)
  const at = { x: dock.at[0], y: dock.at[1], z: dock.at[2] }
  const euler = { x: NONE, y: dock.yaw, z: NONE }
  const { speed, turn, boost, accel, ground, wind } = kind.handling
  const driver: SteerDriver = {
    kind: 'steer',
    speed,
    turn,
    boost,
    accel,
    ground,
    ...(wind === undefined ? {} : { wind }),
  }
  const motion: MoverMotion = {
    trigger: { kind: 'interact', permission: 0 },
    driver,
  }
  const widest = Math.max(
    NONE,
    ...kind.hull.map(
      (box): number =>
        Math.hypot(box.at[0], box.at[2]) + Math.max(box.half[0], box.half[2]),
    ),
  )
  const [sx, sy, sz] = seat.leave
  const carry: MoverCarry = {
    seat: seat.at[1],
    landings: [
      [sx, sy, sz],
      [-sx, sy, sz],
    ],
    yaw: NONE,
    surface: {
      level: FLAT.level,
      bankRamp: FLAT.bankRamp,
      bob: [...FLAT.bob],
      pitch: [...FLAT.pitch],
      roll: [...FLAT.roll],
    },
    prompts: [
      {
        at: [NONE, UP, NONE],
        radius: milli(Math.min(BOARD_MOST, widest + BOARD_MARGIN)),
        label: kind.labels?.drive ?? DRIVE_LABEL,
      },
      {
        at: [NONE, milli(seat.at[1] + LEAVE_RISE), NONE],
        radius: LEAVE_REACH,
        label: kind.labels?.leave ?? LEAVE_LABEL,
      },
    ],
  }
  return {
    id: dock.id,
    entity,
    kind: 'channel',
    at,
    euler,
    enabled: true,
    boxes: [],
    ...lowerMoverMotion(motion, { at, euler }),
    ...motion,
    carry,
    execution: 'native',
  }
}

/** Each dock as a steer carry, entities from `entity` up, for an engine without the vehicle runtime (MSZ8). */
function vehicleCarryMovers(vehicles: Vehicles, entity: number): MoverData {
  const kinds = new Map(
    vehicles.kinds.map((kind): [string, VehicleKind] => [kind.id, kind]),
  )
  return vehicles.docks.flatMap((dock, index): MoverRow[] => {
    const kind = kinds.get(dock.kind)
    return kind === undefined ? [] : [carryRow(dock, kind, entity + index)]
  })
}

/** Each lowered dock's hull as mover boxes in its own frame, by mover id (as engine `vehicleHulls` gives a steer carry's). */
function vehicleCarryHulls(
  vehicles: Vehicles,
): ReadonlyMap<string, readonly MoverBox[]> {
  const kinds = new Map(
    vehicles.kinds.map((kind): [string, VehicleKind] => [kind.id, kind]),
  )
  const hulls = new Map<string, readonly MoverBox[]>()
  for (const dock of vehicles.docks) {
    const boxes = (kinds.get(dock.kind)?.hull ?? []).map((box): MoverBox => {
      const turn = (box.yaw ?? NONE) * HALF
      return {
        x: box.at[0],
        y: box.at[1],
        z: box.at[2],
        hx: box.half[0],
        hy: box.half[1],
        hz: box.half[2],
        rot: { x: NONE, y: Math.sin(turn), z: NONE, w: Math.cos(turn) },
      }
    })
    if (boxes.length > NONE) {
      hulls.set(dock.id, boxes)
    }
  }
  return hulls
}

export { liftSteerVehicles, vehicleCarryHulls, vehicleCarryMovers }
export type { LiftSource, Lifted }
