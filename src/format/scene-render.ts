/**
 * What a three.js scene says about a surface that a shard could not say before (meta SHARD-SOURCE AP10 to AP12): the
 * cleanroom's alpha decals, its camera-facing flame and glow cards, its fireflies and sparks, and the motion an author
 * declares with `animate(...)` (the sdk's scene compiler writes these; no shard code runs at runtime). Each key is absent
 * by default and no default is filled, so an older shard file keeps its bytes.
 *
 * PBR family:
 * - `blend: 'alpha'`: a see-through surface (a stencil, a sign, a decal), drawn after the opaque world, back to front, with
 *   no depth write; `opacity` scales its alpha (absent 1).
 * - `depthOffset`: a polygon offset in depth units (negative pulls the surface toward the camera): a decal on a wall.
 * - `sway`: foliage in the wind. Each vertex moves by its `_SWAY` vertex channel (metres, one float: 0 at the root) along
 *   `direction` (x, z) at about `rate` hertz, its phase taken from where it stands.
 * - `uvScroll`: the colour map's uv moves this many units a second (u, v): running water, drifting cloud shadow.
 *
 * Emissive family:
 * - `blend: 'alpha'` (beside `opaque` and `additive`): an unlit card blended over what is behind it (a flame tongue).
 * - `card: true`: every vertex is a card corner: `position` is the card's seat (world), its `_CORNER` vertex channel
 *   (two floats, metres) the corner's offset in view space, so the card always faces the camera (a three.js `Sprite`,
 *   or one `Points` point drawn as a quad).
 * - `motion` (cards only): `pulse` (the card breathes: height by `amount` at `rate` hertz, a fire's tongue), `drift` (the
 *   seat wanders `radius` metres round itself: fireflies) or `rise` (the seat climbs `height` metres in 1 / `rate`
 *   seconds, spreading `spread` metres and fading out: sparks). Each card's phase comes from its seat.
 *
 * Plain data and checks, no three.js.
 */
import {
  exactOptional,
  finite,
  literal,
  maxValue,
  minValue,
  number,
  picklist,
  pipe,
  strictObject,
  tuple,
  variant,
} from 'valibot'

import type { ExactOptionalSchema, GenericSchema } from 'valibot'

const NONE = 0
const FULL = 1
const DEPTH_OFFSET_MAX = 16
const SWAY_RATE_MAX = 8
const UV_SCROLL_MAX = 10
const MOTION_RATE_MAX = 30
const DRIFT_RADIUS_MAX = 10
const RISE_HEIGHT_MAX = 50
const RISE_SPREAD_MAX = 10
const PULSE_AMOUNT_MAX = 1

/** The PBR family's `sway`: wind along `direction` (x, z) at about `rate` hertz; amplitude per vertex is `_SWAY`. */
interface SurfaceSway {
  rate: number
  direction: [number, number]
}
/** A card's declared motion. */
type CardMotion =
  | { kind: 'pulse'; rate: number; amount: number }
  | { kind: 'drift'; rate: number; radius: number }
  | { kind: 'rise'; rate: number; height: number; spread: number }

const real = pipe(number(), finite())
const range = (low: number, high: number): GenericSchema<number, number> =>
  pipe(real, minValue(low), maxValue(high))
const unit = range(NONE, FULL)
const rate = range(NONE, MOTION_RATE_MAX)

const SurfaceBlendSchema: GenericSchema<
  'opaque' | 'alpha',
  'opaque' | 'alpha'
> = picklist(['opaque', 'alpha'])
const SurfaceSwaySchema: GenericSchema<SurfaceSway, SurfaceSway> = strictObject(
  {
    rate: range(NONE, SWAY_RATE_MAX),
    direction: tuple([range(-FULL, FULL), range(-FULL, FULL)]),
  },
)
const UvScrollSchema: GenericSchema<[number, number], [number, number]> = tuple(
  [range(-UV_SCROLL_MAX, UV_SCROLL_MAX), range(-UV_SCROLL_MAX, UV_SCROLL_MAX)],
)
const CardMotionSchema: GenericSchema<CardMotion, CardMotion> = variant(
  'kind',
  [
    strictObject({
      kind: literal('pulse'),
      rate,
      amount: range(NONE, PULSE_AMOUNT_MAX),
    }),
    strictObject({
      kind: literal('drift'),
      rate,
      radius: range(NONE, DRIFT_RADIUS_MAX),
    }),
    strictObject({
      kind: literal('rise'),
      rate,
      height: range(NONE, RISE_HEIGHT_MAX),
      spread: range(NONE, RISE_SPREAD_MAX),
    }),
  ],
)

/** PBR `blend`: absent is opaque. */
const surfaceBlend: ExactOptionalSchema<
  GenericSchema<'opaque' | 'alpha', 'opaque' | 'alpha'>,
  undefined
> = exactOptional(SurfaceBlendSchema)
/** PBR `opacity`: the alpha blend's scale; absent 1. */
const surfaceOpacity: ExactOptionalSchema<
  GenericSchema<number, number>,
  undefined
> = exactOptional(unit)
/** PBR `depthOffset`: polygon offset factor and units. */
const surfaceDepthOffset: ExactOptionalSchema<
  GenericSchema<number, number>,
  undefined
> = exactOptional(range(-DEPTH_OFFSET_MAX, DEPTH_OFFSET_MAX))
/** PBR `sway`. */
const surfaceSway: ExactOptionalSchema<
  GenericSchema<SurfaceSway, SurfaceSway>,
  undefined
> = exactOptional(SurfaceSwaySchema)
/** PBR `uvScroll`. */
const surfaceUvScroll: ExactOptionalSchema<
  GenericSchema<[number, number], [number, number]>,
  undefined
> = exactOptional(UvScrollSchema)
/** Emissive `card`. */
const emissiveCard: ExactOptionalSchema<
  GenericSchema<true, true>,
  undefined
> = exactOptional(literal(true))
/** Emissive `motion`. */
const emissiveMotion: ExactOptionalSchema<
  GenericSchema<CardMotion, CardMotion>,
  undefined
> = exactOptional(CardMotionSchema)

/** The vertex channel a swaying surface reads (GLB application attribute `_SWAY`, one float, metres). */
const SWAY_CHANNEL = '_SWAY'
/** The vertex channel a card reads (GLB application attribute `_CORNER`, two floats, metres in view space). */
const CORNER_CHANNEL = '_CORNER'

export {
  CORNER_CHANNEL,
  CardMotionSchema,
  SWAY_CHANNEL,
  SurfaceSwaySchema,
  UvScrollSchema,
  emissiveCard,
  emissiveMotion,
  surfaceBlend,
  surfaceDepthOffset,
  surfaceOpacity,
  surfaceSway,
  surfaceUvScroll,
}
export type { CardMotion, SurfaceSway }
