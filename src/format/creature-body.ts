import {
  check,
  exactOptional,
  finite,
  maxLength,
  maxValue,
  minValue,
  number,
  picklist,
  pipe,
  regex,
  strictObject,
  string,
} from 'valibot'

import { CREATURE_SKELETONS } from './creature-skeletons.ts'
import {
  CreatureVolumesSchema,
  CreatureLockSchema,
  MAX_VOLUMES,
} from './creature-volumes.ts'

import type { CreatureSkeleton, CreatureSize } from './creature-layers.ts'
import type { CreatureVolume } from './creature-volumes.ts'
import type { GenericSchema } from 'valibot'

const ONE = 1
const MAX_SCALE = 10
const MAX_ID = 128
const id = pipe(string(), regex(/^[a-z][a-zA-Z0-9.:-]*$/u), maxLength(MAX_ID))
const scalar = pipe(number(), finite())
interface CreatureBody {
  /** Omit for a GLB with its own rig; a kit poser names its contract explicitly. */
  skeleton?: CreatureSkeleton
  size: CreatureSize
  scale: number
  look: string
  volumes?: CreatureVolume[]
  lock?: string[]
  hits?: 'rest' | 'clip'
}
const bodyObject = strictObject({
  skeleton: exactOptional(
    picklist(['quadruped', 'biped'], 'Unknown creature skeleton'),
  ),
  size: picklist(
    ['tiny', 'small', 'medium', 'large', 'giant'],
    'Unknown creature size',
  ),
  scale: pipe(scalar, minValue(Number.MIN_VALUE), maxValue(MAX_SCALE)),
  look: id,
  volumes: exactOptional(CreatureVolumesSchema),
  lock: exactOptional(CreatureLockSchema),
  hits: exactOptional(picklist(['rest', 'clip'])),
})
const CreatureBodySchema: GenericSchema<CreatureBody> = pipe(
  bodyObject,
  check<CreatureBody, 'Only giants have multiple lock points or clip hits'>(
    (body: {
      readonly size: CreatureSize
      readonly lock?: readonly string[]
      readonly hits?: 'rest' | 'clip'
    }): boolean =>
      body.size === 'giant' ||
      ((body.lock?.length ?? ONE) <= ONE && body.hits !== 'clip'),
    'Only giants have multiple lock points or clip hits',
  ),
  check<CreatureBody, 'Too many resolved creature volumes'>(
    (body: {
      readonly skeleton?: CreatureSkeleton
      readonly volumes?: readonly { readonly part: string }[]
    }): boolean => {
      const defaults =
        body.skeleton === undefined
          ? []
          : CREATURE_SKELETONS[body.skeleton].volumes
      return (
        new Set(
          [...defaults, ...(body.volumes ?? [])].map(
            (volume: { readonly part: string }): string => volume.part,
          ),
        ).size <= MAX_VOLUMES
      )
    },
    'Too many resolved creature volumes',
  ),
)

export { CreatureBodySchema }
export type { CreatureBody }
