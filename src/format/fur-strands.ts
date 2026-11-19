/**
 * A creature surface's fur grain (meta ONE-FORMAT OF3c2): the tileable strand albedo and normal texture the engine's
 * creature factory draws its fur with (`AnimalFactory` `makeFurCanvases`), given as its numbers, so a `platform.skin`
 * look made by the kit carries the same grain at no byte cost. The texture runs along the mesh's UVs (one repeat per
 * 0.32 m of a lofted body); the toon family multiplies its colour by the albedo, the PBR family takes both maps.
 *
 * - `seed`: the texture's seed (the factory's per-kind `texSeed`).
 * - `contrast`: how far the strands swing the albedo; `grizzle`: pale guard-hair streaks; `bristle`: coarse mottling.
 * - `normalStrength`: the strand relief in the normal map; `strandLen`: strand segments per repeat along V.
 * - `root`: how much darker each strand is at its root than at its tip.
 *
 * Absent: none, as before (no default is filled, so older shard files keep their bytes). Plain data, no three.js.
 */
import {
  exactOptional,
  finite,
  integer,
  maxValue,
  minValue,
  number,
  pipe,
  strictObject,
} from 'valibot'

import type { ExactOptionalSchema, GenericSchema } from 'valibot'

interface FurStrands {
  seed: number
  contrast: number
  grizzle: number
  normalStrength: number
  bristle: number
  strandLen: number
  root: number
}

const NONE = 0
const FULL = 1
const CONTRAST_MAX = 2
const RELIEF_MAX = 8
const SEED_MAX = 2_147_483_647
const STRANDS_MIN = 1
const STRANDS_MAX = 64

const real = pipe(number(), finite())
const unit = pipe(real, minValue(NONE), maxValue(FULL))
const FurStrandsSchema: GenericSchema<FurStrands, FurStrands> = strictObject({
  seed: pipe(real, integer(), minValue(NONE), maxValue(SEED_MAX)),
  contrast: pipe(real, minValue(NONE), maxValue(CONTRAST_MAX)),
  grizzle: unit,
  normalStrength: pipe(real, minValue(NONE), maxValue(RELIEF_MAX)),
  bristle: unit,
  strandLen: pipe(real, minValue(STRANDS_MIN), maxValue(STRANDS_MAX)),
  root: unit,
})
/** The toon and PBR families' optional `strands` key. */
const furStrands: ExactOptionalSchema<
  GenericSchema<FurStrands, FurStrands>,
  undefined
> = exactOptional(FurStrandsSchema)

export { FurStrandsSchema, furStrands, type FurStrands }
