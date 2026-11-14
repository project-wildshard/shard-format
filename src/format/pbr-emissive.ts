/**
 * A PBR surface's own glow (meta SHARD-SOURCE M4.3, the cleanroom's lit lamp glass, candles and coins): three's
 * `MeshStandardMaterial.emissive` and `emissiveIntensity`. A glowing PBR surface stays lit by the sun and lamps and adds
 * its glow on top, where the unlit emissive family draws only the glow. Absent: no glow, as before (no default is filled,
 * so older shard files keep their bytes).
 *
 * - `emissive`: the glow's sRGB colour.
 * - `emissiveIntensity`: its linear gain (HDR, so a bright pane blooms), 1 when only `emissive` is given.
 *
 * Plain data and checks, no three.js.
 */
import {
  exactOptional,
  finite,
  maxValue,
  minValue,
  number,
  pipe,
  tuple,
} from 'valibot'

import type { ExactOptionalSchema, GenericSchema } from 'valibot'

type Rgb = [number, number, number]

const NONE = 0
const FULL = 1
const GAIN_MAX = 64

const real = pipe(number(), finite())
const unit = pipe(real, minValue(NONE), maxValue(FULL))
const PbrEmissiveColourSchema: GenericSchema<Rgb, Rgb> = tuple([
  unit,
  unit,
  unit,
])
const PbrEmissiveIntensitySchema: GenericSchema<number, number> = pipe(
  real,
  minValue(NONE),
  maxValue(GAIN_MAX),
)
/** The PBR family's optional `emissive` key. */
const pbrEmissive: ExactOptionalSchema<
  GenericSchema<Rgb, Rgb>,
  undefined
> = exactOptional(PbrEmissiveColourSchema)
/** The PBR family's optional `emissiveIntensity` key. */
const pbrEmissiveIntensity: ExactOptionalSchema<
  GenericSchema<number, number>,
  undefined
> = exactOptional(PbrEmissiveIntensitySchema)

export {
  PbrEmissiveColourSchema,
  PbrEmissiveIntensitySchema,
  pbrEmissive,
  pbrEmissiveIntensity,
}
