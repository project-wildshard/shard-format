/**
 * How a pool's surface draws (meta TEMPLATES-CLEANROOM M4.1), the optional `surface` of a `water.json` pool:
 *
 * - `reflect`: `planar` mirrors the scene (desktop; phones fall back to `sky`), `sky` reflects the look's sky only.
 * - `tint` (linear): the colour looked straight down into.
 * - `fresnel`: the reflection's share face-on, and the power it rises by toward grazing.
 * - `ripple`: the surface's small waves, `scale` per metre, `amplitude` (screen-space offset), `speed`.
 * - `resolution`: the mirror's texels on a side (absent: the engine's choice for the tier).
 *
 * Absent: the engine's default water, as before. Plain data and checks, no three.js.
 */
import {
  exactOptional,
  finite,
  integer,
  maxValue,
  minValue,
  number,
  picklist,
  pipe,
  strictObject,
  tuple,
} from 'valibot'

import type { GenericSchema } from 'valibot'

type Rgb = [number, number, number]

const NONE = 0
const FULL = 1
const FRESNEL_POWER_MIN = 0.5
const FRESNEL_POWER_MAX = 8
const RIPPLE_SCALE_MAX = 20
const RIPPLE_AMPLITUDE_MAX = 0.05
const RIPPLE_SPEED_MAX = 8
const RESOLUTION_MIN = 128
const RESOLUTION_MAX = 2048

/** A pool's small waves. */
interface PoolRipple {
  scale: number
  amplitude: number
  speed: number
}
/** A pool's drawn surface. */
interface PoolSurface {
  reflect: 'planar' | 'sky'
  tint: Rgb
  fresnel: [number, number]
  ripple: PoolRipple
  resolution?: number
}

const real = pipe(number(), finite())
const range = (low: number, high: number): GenericSchema<number, number> =>
  pipe(real, minValue(low), maxValue(high))
const unit = range(NONE, FULL)
const tint: GenericSchema<Rgb, Rgb> = tuple([unit, unit, unit])
const fresnelPower = range(FRESNEL_POWER_MIN, FRESNEL_POWER_MAX)
const fresnel: GenericSchema<[number, number], [number, number]> = tuple([
  unit,
  fresnelPower,
])
const PoolRippleSchema: GenericSchema<PoolRipple, PoolRipple> = strictObject({
  scale: range(NONE, RIPPLE_SCALE_MAX),
  amplitude: range(NONE, RIPPLE_AMPLITUDE_MAX),
  speed: range(NONE, RIPPLE_SPEED_MAX),
})
const texels = pipe(
  real,
  integer(),
  minValue(RESOLUTION_MIN),
  maxValue(RESOLUTION_MAX),
)
const PoolSurfaceSchema: GenericSchema<PoolSurface, PoolSurface> = strictObject(
  {
    reflect: picklist(['planar', 'sky']),
    tint,
    fresnel,
    ripple: PoolRippleSchema,
    resolution: exactOptional(texels),
  },
)

export { PoolRippleSchema, PoolSurfaceSchema }
export type { PoolRipple, PoolSurface }
