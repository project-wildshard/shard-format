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
 * - `lamps` (meta TEMPLATES-CLEANROOM B2): real point lights for lanterns, tent lamps and fires, at most 16, each at
 *   `at` in linear `colour` × `intensity` (candela), out to `distance` metres with physical (2) decay, no shadow.
 * - `bounce` (B2): a warm fill from the ground: one shadowless directional light from the anti-sun heading, lifted
 *   by `lift` (0 level, 1 straight up), in linear `colour` × `intensity`.
 * - `environment` (B2): sky-derived ambient: an environment filtered once from the look's own sky (its keys' zenith
 *   and horizon) over a `ground` colour (linear), lighting every PBR surface at `intensity`.
 *
 * `look.grade.tone` (B2) picks the display curve: `agx` (absent: the engine's AgX, as before) or `neutral` (Khronos PBR
 * Neutral, which keeps saturated albedo saturated).
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
  picklist,
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
/** At most this many lamps in one look (real point lights: each costs every lit draw a light loop step). */
const LOOK_LIGHT_LAMPS_MAX = 16
const LAMP_INTENSITY_MAX = 100
const LAMP_DISTANCE_MIN = 0.1
const LAMP_DISTANCE_MAX = 50
const BOUNCE_INTENSITY_MAX = 4
const ENVIRONMENT_INTENSITY_MAX = 4

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
/** One lamp: a point light at `at`, `colour` × `intensity` (candela), out to `distance` metres, decay 2, no shadow. */
interface LookLamp {
  at: Point
  colour: Rgb
  intensity: number
  distance: number
}
/** A warm fill from the ground: a shadowless directional light from the anti-sun heading, lifted by `lift`. */
interface LookBounce {
  colour: Rgb
  intensity: number
  lift: number
}
/** Sky-derived ambient: the look's sky over a `ground` colour, filtered once, at `intensity`. */
interface LookEnvironment {
  intensity: number
  ground: Rgb
}
/** `look.light`: each setting off when absent. */
interface LookLight {
  ao?: LookAo
  rim?: LookRim
  heightFog?: LookHeightFog
  pools?: LookPools
  lamps?: LookLamp[]
  bounce?: LookBounce
  environment?: LookEnvironment
}
/** `look.grade.tone`: the display curve; absent is the engine's AgX. */
type LookTone = 'agx' | 'neutral'
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
const LookLampSchema: GenericSchema<LookLamp, LookLamp> = strictObject({
  at: point,
  colour,
  intensity: range(NONE, LAMP_INTENSITY_MAX),
  distance: range(LAMP_DISTANCE_MIN, LAMP_DISTANCE_MAX),
})
const LookLampsSchema: GenericSchema<LookLamp[], LookLamp[]> = pipe(
  array(LookLampSchema),
  minLength(FULL),
  maxLength(LOOK_LIGHT_LAMPS_MAX),
)
const LookBounceSchema: GenericSchema<LookBounce, LookBounce> = strictObject({
  colour,
  intensity: range(NONE, BOUNCE_INTENSITY_MAX),
  lift: range(NONE, FULL),
})
const LookEnvironmentSchema: GenericSchema<LookEnvironment, LookEnvironment> =
  strictObject({
    intensity: range(NONE, ENVIRONMENT_INTENSITY_MAX),
    ground: colour,
  })
/** `look.light`: the optional light and post settings. */
const LookLightSchema: GenericSchema<LookLight, LookLight> = strictObject({
  ao: exactOptional(LookAoSchema),
  rim: exactOptional(LookRimSchema),
  heightFog: exactOptional(LookHeightFogSchema),
  pools: exactOptional(LookPoolsSchema),
  lamps: exactOptional(LookLampsSchema),
  bounce: exactOptional(LookBounceSchema),
  environment: exactOptional(LookEnvironmentSchema),
})
/** `look.grade.tone`: absent is AgX, as before. */
const LookToneSchema: GenericSchema<LookTone, LookTone> = picklist([
  'agx',
  'neutral',
])
/** `look.grade.bloom`: absent is no bloom, as before. */
const LookBloomSchema: GenericSchema<LookBloom, LookBloom> = strictObject({
  intensity: range(NONE, BLOOM_INTENSITY_MAX),
  threshold: range(NONE, FULL),
})

export {
  LOOK_LIGHT_LAMPS_MAX,
  LOOK_LIGHT_POOLS_MAX,
  LookAoSchema,
  LookBloomSchema,
  LookBounceSchema,
  LookEnvironmentSchema,
  LookHeightFogSchema,
  LookLampSchema,
  LookLightSchema,
  LookPoolsSchema,
  LookRimSchema,
  LookToneSchema,
}
export type {
  LookAo,
  LookBloom,
  LookBloomInput,
  LookBounce,
  LookEnvironment,
  LookHeightFog,
  LookLamp,
  LookLight,
  LookLightInput,
  LookPools,
  LookRim,
  LookTone,
}
