/**
 * The render-match settings of a look (meta TEMPLATES-CLEANROOM M4): what a cleanroom three.js scene sets that a shard
 * could not say before. Each is off when absent, and no default is filled, so an older shard file keeps its bytes.
 *
 * - `look.light.shadow`: the sun's shadow look: `intensity` (0 none, 1 black), the filter `radius` (texels) and the
 *   `normalBias` (metres) that keeps faces from shadowing themselves.
 * - a lamp's `decay` (absent 2: physical), `halo` (a soft additive glow `size` metres across at `opacity`, one instanced
 *   draw for every halo) and `flicker` (`amount` of its intensity at about `rate` hertz: a fire's unsteady light).
 * - `look.light.motes`: fireflies, sparks or dust: `count` glowing points drifting in the box `min`..`max`, in linear
 *   `colour` × `gain` (over 1 blooms), `size` metres across, one additive draw; phones draw half.
 * - `look.grade.vignette`: the frame's dark edge, from `offset` (0 centre, 1 corner) at `darkness` (0 none); absent is
 *   the engine's own vignette.
 *
 * Plain data and checks, no three.js.
 */
import {
  check,
  exactOptional,
  finite,
  integer,
  maxValue,
  minValue,
  number,
  pipe,
  strictObject,
  tuple,
} from 'valibot'

import type { ExactOptionalSchema, GenericSchema } from 'valibot'

type Rgb = [number, number, number]
type Point = [number, number, number]

const NONE = 0
const FULL = 1
const SHADOW_RADIUS_MAX = 16
const SHADOW_NORMAL_BIAS_MAX = 0.5
const LAMP_DECAY_MAX = 2
const HALO_SIZE_MIN = 0.05
const HALO_SIZE_MAX = 8
const FLICKER_RATE_MAX = 30
/** At most this many motes in one look (one points draw). */
const LOOK_LIGHT_MOTES_MAX = 2048
const MOTE_GAIN_MAX = 8
const MOTE_SIZE_MIN = 0.005
const MOTE_SIZE_MAX = 1
const AXIS_X = 0
const AXIS_Y = 1
const AXIS_Z = 2

/** The sun's shadow look. */
interface LookShadow {
  intensity: number
  radius: number
  normalBias: number
}
/** A lamp's glow: an additive halo `size` metres across at `opacity`. */
interface LookLampHalo {
  size: number
  opacity: number
}
/** A lamp's flicker: `amount` (0 to 1) of its intensity, at about `rate` hertz. */
interface LookLampFlicker {
  rate: number
  amount: number
}
/** Glowing motes drifting in the box `min`..`max`. */
interface LookMotes {
  count: number
  min: Point
  max: Point
  colour: Rgb
  gain: number
  size: number
}
/** `look.grade.vignette`: the frame's dark edge. */
interface LookVignette {
  offset: number
  darkness: number
}

const real = pipe(number(), finite())
const range = (low: number, high: number): GenericSchema<number, number> =>
  pipe(real, minValue(low), maxValue(high))
const unit = range(NONE, FULL)
const colour: GenericSchema<Rgb, Rgb> = tuple([unit, unit, unit])
const point: GenericSchema<Point, Point> = tuple([real, real, real])
const moteCount = pipe(
  real,
  integer(),
  minValue(FULL),
  maxValue(LOOK_LIGHT_MOTES_MAX),
)

const LookShadowSchema: GenericSchema<LookShadow, LookShadow> = strictObject({
  intensity: unit,
  radius: range(NONE, SHADOW_RADIUS_MAX),
  normalBias: range(NONE, SHADOW_NORMAL_BIAS_MAX),
})
const LookLampHaloSchema: GenericSchema<LookLampHalo, LookLampHalo> =
  strictObject({ size: range(HALO_SIZE_MIN, HALO_SIZE_MAX), opacity: unit })
const LookLampFlickerSchema: GenericSchema<LookLampFlicker, LookLampFlicker> =
  strictObject({ rate: range(NONE, FLICKER_RATE_MAX), amount: unit })
const lampDecay: ExactOptionalSchema<
  GenericSchema<number, number>,
  undefined
> = exactOptional(range(NONE, LAMP_DECAY_MAX))
const lampHalo: ExactOptionalSchema<
  GenericSchema<LookLampHalo, LookLampHalo>,
  undefined
> = exactOptional(LookLampHaloSchema)
const lampFlicker: ExactOptionalSchema<
  GenericSchema<LookLampFlicker, LookLampFlicker>,
  undefined
> = exactOptional(LookLampFlickerSchema)

/** A box's corners, read only. */
interface MotesBox {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
}
function ordered(row: MotesBox): boolean {
  return (
    row.min[AXIS_X] <= row.max[AXIS_X] &&
    row.min[AXIS_Y] <= row.max[AXIS_Y] &&
    row.min[AXIS_Z] <= row.max[AXIS_Z]
  )
}
const motesRow = strictObject({
  count: moteCount,
  min: point,
  max: point,
  colour,
  gain: range(NONE, MOTE_GAIN_MAX),
  size: range(MOTE_SIZE_MIN, MOTE_SIZE_MAX),
})
const LookMotesSchema: GenericSchema<LookMotes, LookMotes> = pipe(
  motesRow,
  check<LookMotes, string>(ordered, 'Motes box min must not exceed max'),
)
const LookVignetteSchema: GenericSchema<LookVignette, LookVignette> =
  strictObject({ offset: unit, darkness: unit })

export {
  LOOK_LIGHT_MOTES_MAX,
  LookLampFlickerSchema,
  LookLampHaloSchema,
  LookMotesSchema,
  LookShadowSchema,
  LookVignetteSchema,
  lampDecay,
  lampFlicker,
  lampHalo,
}
export type {
  LookLampFlicker,
  LookLampHalo,
  LookMotes,
  LookShadow,
  LookVignette,
}
