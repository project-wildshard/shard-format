/**
 * A PBR surface's procedural detail layer (meta TEMPLATES-CLEANROOM M4.11, J338 "procedural maxxing"): the texture a
 * cleanroom paints on canvases (stone, slab, wood, moss), made in the shader from world position, so it costs no bytes
 * and needs no UVs. Absent: a plain surface, as before (no default is filled, so older shard files keep their bytes).
 *
 * - `scale`: the pattern's feature size in metres (a stone's mottling, a moss clump).
 * - `mottle`: how far the broad blotches swing the albedo (0 none, 1 from black to double).
 * - `grain`: the fine speckle's share of the albedo.
 * - `relief`: how much the pattern tilts the shading normal (bumps).
 * - `moss`: an optional moss colour (sRGB) grown on up-facing faces by `amount` (0 none, 1 every top).
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
  strictObject,
  tuple,
} from 'valibot'

import type { ExactOptionalSchema, GenericSchema } from 'valibot'

type Rgb = [number, number, number]

const NONE = 0
const FULL = 1
const SCALE_MIN = 0.02
const SCALE_MAX = 20
const RELIEF_MAX = 2

/** Moss on up-facing faces. */
interface DetailMoss {
  colour: Rgb
  amount: number
}
/** A procedural detail layer. */
interface DetailLayer {
  scale: number
  mottle: number
  grain: number
  relief: number
  moss?: DetailMoss
}

const real = pipe(number(), finite())
const range = (low: number, high: number): GenericSchema<number, number> =>
  pipe(real, minValue(low), maxValue(high))
const unit = range(NONE, FULL)
const DetailMossSchema: GenericSchema<DetailMoss, DetailMoss> = strictObject({
  colour: tuple([unit, unit, unit]),
  amount: unit,
})
const DetailLayerSchema: GenericSchema<DetailLayer, DetailLayer> = strictObject(
  {
    scale: range(SCALE_MIN, SCALE_MAX),
    mottle: unit,
    grain: unit,
    relief: range(NONE, RELIEF_MAX),
    moss: exactOptional(DetailMossSchema),
  },
)
/** The PBR family's optional `detail` key. */
const detailLayer: ExactOptionalSchema<
  GenericSchema<DetailLayer, DetailLayer>,
  undefined
> = exactOptional(DetailLayerSchema)

export { DetailLayerSchema, DetailMossSchema, detailLayer }
export type { DetailLayer, DetailMoss }
