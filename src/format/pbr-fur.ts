/**
 * A PBR surface's fur (meta ONE-FORMAT OF27b, the hull-book look as a skin): the velvet sheen and the backlit rim that
 * a rigged hull's coat drew with (engine `AnimalFactory`'s hull material and its fur rim), so a `platform.skin` look
 * draws as the hull book did.
 *
 * - `sheen`: three's `MeshPhysicalMaterial` sheen, `amount` (0..1) of `colour` (linear, a light term) at `roughness`.
 * - `rim`: the backlit Fresnel rim's colour (linear, HDR allowed): strongest looking toward the sun, fading past 10 m.
 *
 * Absent: none, as before (no default is filled, so older shard files keep their bytes). A skin variant may wear its
 * own sheen and rim with its coat (`skin-variants.ts`). Plain data and checks, no three.js.
 */
import {
  exactOptional,
  finite,
  maxValue,
  minValue,
  number,
  pipe,
  strictObject,
  tuple,
} from 'valibot'

import type { ExactOptionalSchema, GenericSchema } from 'valibot'

type Rgb = [number, number, number]
interface PbrSheen {
  amount: number
  colour: Rgb
  roughness: number
}

const NONE = 0
const FULL = 1
const LIGHT_MAX = 16

const real = pipe(number(), finite())
const unit = pipe(real, minValue(NONE), maxValue(FULL))
const light = pipe(real, minValue(NONE), maxValue(LIGHT_MAX))
const linear: GenericSchema<Rgb, Rgb> = tuple([light, light, light])
const PbrSheenSchema: GenericSchema<PbrSheen, PbrSheen> = strictObject({
  amount: unit,
  colour: linear,
  roughness: unit,
})
/** The PBR family's optional `sheen` key. */
const pbrSheen: ExactOptionalSchema<
  GenericSchema<PbrSheen, PbrSheen>,
  undefined
> = exactOptional(PbrSheenSchema)
/** The PBR family's optional `rim` key. */
const pbrRim: ExactOptionalSchema<
  GenericSchema<Rgb, Rgb>,
  undefined
> = exactOptional(linear)

export { PbrSheenSchema, pbrRim, pbrSheen, type PbrSheen }
