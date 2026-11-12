/**
 * A look's light and post settings (meta TEMPLATE-E2E-PLAN LF1-4): optional `look.light` settings for any shard, each off
 * when absent, and `look.grade.bloom` (LF1-2's leftover: a shardfile shard's bloom was hard-wired to 0).
 *
 * - `ao`: the engine's screen-space ambient occlusion (half resolution, desktop tier only) as contact shadows.
 * - `rim`: a warm rim on every lit surface, a view fresnel term (`strength` × (1 − n·v)^`power`, in linear `colour`).
 * - `heightFog`: mist that pools in low spots: density per metre at `height` (metres, world y), thinning by `falloff`
 *   per metre above it. It adds to the day keys' distance fog, so a shard can drop that to 0 and keep mist only low.
 * - `pools`: warm light pools on the ground under lamps, drawn as one additive decal draw (no dynamic light per lamp):
 *   a disc of `radius` metres at each `at` point, in `colour` × `intensity`.
 *
 * Plain data and checks, no three.js. Absent keys stay absent (no filled default), so a product built before these keys
 * parses to the same bytes and keeps its source hash.
 */
import {
  array,
  exactOptional,
  finite,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  pipe,
  strictObject,
  tuple,
} from 'valibot'

import type { GenericSchema } from 'valibot'

type Rgb = [number, number, number]
type Point = [number, number, number]

/** At most this many light pools in one look (one instanced draw). */
const LOOK_LIGHT_POOLS_MAX = 64
const NONE = 0
const FULL = 1
const AO_INTENSITY_MAX = 8
const AO_RADIUS_MIN = 0.1
const AO_RADIUS_MAX = 10
const RIM_STRENGTH_MAX = 2
const RIM_POWER_MIN = 0.5
const RIM_POWER_MAX = 8
const FOG_HEIGHT_LIMIT = 1000
const FOG_FALLOFF_MIN = 0.01
const FOG_FALLOFF_MAX = 10
const POOL_INTENSITY_MAX = 4
const POOL_RADIUS_MIN = 0.1
const POOL_RADIUS_MAX = 20
const BLOOM_INTENSITY_MAX = 4

/** Contact shadows: the engine's screen-space AO at this intensity and world radius (metres). */
interface LookAo {
  intensity: number
  radius: number
}
/** A warm rim: `strength` × (1 − n·v)^`power` in linear `colour`, added to every lit surface. */
interface LookRim {
  colour: Rgb
  strength: number
  power: number
}
/** Mist in low spots: density per metre at `height` (world y), thinning by `falloff` per metre above it. */
interface LookHeightFog {
  density: number
  height: number
  falloff: number
}
/** Ground light pools under lamps: one additive decal disc per point, one draw for all. */
interface LookPools {
  colour: Rgb
  intensity: number
  radius: number
  at: Point[]
}
/** `look.light`: each setting off when absent. */
interface LookLight {
  ao?: LookAo
  rim?: LookRim
  heightFog?: LookHeightFog
  pools?: LookPools
}
/** `look.grade.bloom`: the engine bloom's intensity and luminance threshold. */
interface LookBloom {
  intensity: number
  threshold: number
}
type LookLightInput = LookLight
type LookBloomInput = LookBloom

const real = pipe(number(), finite())
const range = (low: number, high: number): GenericSchema<number, number> =>
  pipe(real, minValue(low), maxValue(high))
const colour: GenericSchema<Rgb, Rgb> = tuple([
  range(NONE, FULL),
  range(NONE, FULL),
  range(NONE, FULL),
])
const point: GenericSchema<Point, Point> = tuple([real, real, real])

const LookAoSchema: GenericSchema<LookAo, LookAo> = strictObject({
  intensity: range(NONE, AO_INTENSITY_MAX),
  radius: range(AO_RADIUS_MIN, AO_RADIUS_MAX),
})
const LookRimSchema: GenericSchema<LookRim, LookRim> = strictObject({
  colour,
  strength: range(NONE, RIM_STRENGTH_MAX),
  power: range(RIM_POWER_MIN, RIM_POWER_MAX),
})
const LookHeightFogSchema: GenericSchema<LookHeightFog, LookHeightFog> =
  strictObject({
    density: range(NONE, FULL),
    height: range(-FOG_HEIGHT_LIMIT, FOG_HEIGHT_LIMIT),
    falloff: range(FOG_FALLOFF_MIN, FOG_FALLOFF_MAX),
  })
const LookPoolsSchema: GenericSchema<LookPools, LookPools> = strictObject({
  colour,
  intensity: range(NONE, POOL_INTENSITY_MAX),
  radius: range(POOL_RADIUS_MIN, POOL_RADIUS_MAX),
  at: pipe(array(point), minLength(FULL), maxLength(LOOK_LIGHT_POOLS_MAX)),
})
/** `look.light`: the optional light and post settings. */
const LookLightSchema: GenericSchema<LookLight, LookLight> = strictObject({
  ao: exactOptional(LookAoSchema),
  rim: exactOptional(LookRimSchema),
  heightFog: exactOptional(LookHeightFogSchema),
  pools: exactOptional(LookPoolsSchema),
})
/** `look.grade.bloom`: absent is no bloom, as before. */
const LookBloomSchema: GenericSchema<LookBloom, LookBloom> = strictObject({
  intensity: range(NONE, BLOOM_INTENSITY_MAX),
  threshold: range(NONE, FULL),
})

export {
  LOOK_LIGHT_POOLS_MAX,
  LookAoSchema,
  LookBloomSchema,
  LookHeightFogSchema,
  LookLightSchema,
  LookPoolsSchema,
  LookRimSchema,
}
export type {
  LookAo,
  LookBloom,
  LookBloomInput,
  LookHeightFog,
  LookLight,
  LookLightInput,
  LookPools,
  LookRim,
}
