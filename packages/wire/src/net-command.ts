import {
  exactOptional,
  finite,
  integer,
  literal,
  maxValue,
  minValue,
  number,
  picklist,
  pipe,
  regex,
  strictObject,
  string,
  variant,
} from 'valibot'

import type { GenericSchema } from 'valibot'

// P1-E5.2 (E5-REPLICATION §4.2): the admission grammar of decoded input. Bytes
// from a client are decoded first, then every command and act passes through
// these schemas before the room queues it (MMO-REQUIREMENTS R3). The aim
// carries world coordinates, as AimCommand does; the bounds keep a hostile
// value out of the fixed tick. Moved here from `@wildshard/shard-format/netCommand`
// (WIRE-STABILITY WR2), which re-exports it unchanged.

const ZERO = 0
const ONE = 1
const HALVES = 2
const U16_TOP = 65_535
const SLOT_TOP = 31
const ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/u
/** Pitch may sit a hair past a right angle once quantized. */
const PITCH_SLACK = 1e-3
const PITCH_LIMIT = Math.PI / HALVES + PITCH_SLACK

const finiteNumber = pipe(number(), finite())
const u16 = pipe(finiteNumber, integer(), minValue(ZERO), maxValue(U16_TOP))
const axis = pipe(finiteNumber, minValue(-ONE), maxValue(ONE))
const unit = pipe(finiteNumber, minValue(ZERO), maxValue(ONE))
/* oxlint-disable id-length -- world axes are x, y and z on the wire */
const point = strictObject({
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
})
/* oxlint-enable id-length */
const id = pipe(string(), regex(ID_PATTERN))
const slot = pipe(finiteNumber, integer(), minValue(ZERO), maxValue(SLOT_TOP))
const aim = strictObject({ origin: point, direction: point })
const attack = strictObject({ targetId: exactOptional(id), aim })
const launcher = strictObject({
  slot,
  ads: unit,
  fire: exactOptional(literal(true)),
})
/** The riding acts: hold out an offer to a wild mount, climb on, climb off. */
const RIDE_ACTIONS = ['offer', 'mount', 'dismount'] as const

/** A world point or direction. */
interface NetPoint {
  // oxlint-disable-next-line id-length -- world axes are x, y and z on the wire
  readonly x: number
  // oxlint-disable-next-line id-length -- world axes are x, y and z on the wire
  readonly y: number
  // oxlint-disable-next-line id-length -- world axes are x, y and z on the wire
  readonly z: number
}
/** Raw local axes, as LocalSteer holds them. */
interface NetSteer {
  readonly keyX: number
  readonly keyY: number
  readonly stickX: number
  readonly stickY: number
}
/** World-space aim, as AimCommand holds it. */
interface NetAim {
  readonly origin: NetPoint
  readonly direction: NetPoint
}
/** One client sim step of input (§4.2). */
interface NetCommand {
  /** Wrapping, one per client sim step. */
  readonly seq: number
  /** The low 16 bits of the server tick the client was rendering others at, for the rewind in E5.3. */
  readonly viewTick: number
  readonly steer: NetSteer
  readonly yaw: number
  readonly pitch: number
  /** NET_BUTTONS bits, 16 of them: the presses jump, dodge, hover, lock; the holds sprint, crouch, dive, surface, heavy. */
  readonly buttons: number
  /** A swing or shot start (J41); `targetId` keeps today's lock-on. */
  readonly attack?: { readonly targetId?: string; readonly aim: NetAim }
  /** What the heavy hold is aimed at while the crosshair is on something. */
  readonly heavyTarget?: string
  /** J116: the target this client's lock-on orbits. Both sides compute the same orbit from it; the server checks it is real and in range. */
  readonly lockTarget?: string
  /** The hook a LOCK press picks: its index in the course's `hooks`, which have no id or handle. The server checks it is real, in range and in sight. */
  readonly hookTarget?: number
  readonly launcher?: {
    readonly slot: number
    readonly ads: number
    readonly fire?: true
  }
}
/** A non-movement action that must not be lost (§4.2), carrying the `seq` it belongs to. */
type NetAct =
  | { readonly kind: 'interact'; readonly seq: number; readonly id: string }
  | { readonly kind: 'reload'; readonly seq: number; readonly slot: number }
  | { readonly kind: 'equip'; readonly seq: number; readonly slot: number }
  | {
      readonly kind: 'ride'
      readonly seq: number
      readonly action: (typeof RIDE_ACTIONS)[number]
    }

/** A decoded command fit for the fixed tick. */
const NetCommandSchema: GenericSchema<NetCommand> = strictObject({
  seq: u16,
  viewTick: u16,
  steer: strictObject({ keyX: axis, keyY: axis, stickX: axis, stickY: axis }),
  yaw: finiteNumber,
  pitch: pipe(finiteNumber, minValue(-PITCH_LIMIT), maxValue(PITCH_LIMIT)),
  buttons: u16,
  attack: exactOptional(attack),
  heavyTarget: exactOptional(id),
  lockTarget: exactOptional(id),
  hookTarget: exactOptional(u16),
  launcher: exactOptional(launcher),
})
/** A decoded act fit for the fixed tick. */
const NetActSchema: GenericSchema<NetAct> = variant('kind', [
  strictObject({ kind: literal('interact'), seq: u16, id }),
  strictObject({ kind: literal('reload'), seq: u16, slot }),
  strictObject({ kind: literal('equip'), seq: u16, slot }),
  strictObject({
    kind: literal('ride'),
    seq: u16,
    action: picklist(RIDE_ACTIONS),
  }),
])

export {
  NetActSchema,
  NetCommandSchema,
  RIDE_ACTIONS,
  type NetAct,
  type NetAim,
  type NetCommand,
  type NetSteer,
}
