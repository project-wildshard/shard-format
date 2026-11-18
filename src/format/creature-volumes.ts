import {
  array,
  check,
  exactOptional,
  finite,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  picklist,
  pipe,
  regex,
  strictObject,
  string,
  tuple,
} from 'valibot'

import type { SkeletonVolume } from './creature-skeletons.ts'
import type { GenericSchema } from 'valibot'

/** Bone-local rest offset. The runtime clamps the scaled radius, not the source. */
interface CreatureVolume extends SkeletonVolume {
  at?: [number, number, number]
}
const ZERO = 0
const ONE = 1
const MAX_VOLUMES = 16
const MAX_NAME = 128
const MAX_EXTENT = 500
const MAX_MULTIPLIER = 100
const CreatureSocketNameSchema: GenericSchema<string> = pipe(
  string(),
  regex(/^[a-zA-Z][a-zA-Z0-9_.:-]*$/u),
  maxLength(MAX_NAME),
)
const scalar = pipe(number(), finite())
const extent = pipe(scalar, minValue(ZERO), maxValue(MAX_EXTENT))
const offset = pipe(scalar, minValue(-MAX_EXTENT), maxValue(MAX_EXTENT))
const volumeObject = strictObject({
  part: CreatureSocketNameSchema,
  bone: CreatureSocketNameSchema,
  shape: picklist(['sphere', 'capsule']),
  radius: pipe(scalar, minValue(Number.MIN_VALUE), maxValue(MAX_EXTENT)),
  halfLength: extent,
  axis: picklist(['y', 'z']),
  multiplier: pipe(scalar, minValue(ZERO), maxValue(MAX_MULTIPLIER)),
  at: exactOptional(tuple([offset, offset, offset])),
})
const CreatureVolumeSchema: GenericSchema<CreatureVolume> = pipe(
  volumeObject,
  check<CreatureVolume, 'A sphere has zero halfLength'>(
    (row: Readonly<Pick<CreatureVolume, 'shape' | 'halfLength'>>): boolean =>
      row.shape !== 'sphere' || row.halfLength === ZERO,
    'A sphere has zero halfLength',
  ),
)
const CreatureVolumesSchema: GenericSchema<CreatureVolume[]> = pipe(
  array(CreatureVolumeSchema),
  minLength(ONE),
  maxLength(MAX_VOLUMES),
  check<CreatureVolume[], 'Duplicate creature volume part'>(
    (rows: readonly { readonly part: string }[]): boolean =>
      new Set(rows.map((row: { readonly part: string }): string => row.part))
        .size === rows.length,
    'Duplicate creature volume part',
  ),
)
const CreatureLockSchema: GenericSchema<string[]> = pipe(
  array(CreatureSocketNameSchema),
  minLength(ONE),
  maxLength(MAX_VOLUMES),
  check<string[], 'Duplicate creature lock point'>(
    (rows: readonly string[]): boolean => new Set(rows).size === rows.length,
    'Duplicate creature lock point',
  ),
)

export {
  CreatureVolumeSchema,
  CreatureVolumesSchema,
  CreatureLockSchema,
  CreatureSocketNameSchema,
  MAX_VOLUMES,
}
export type { CreatureVolume }
