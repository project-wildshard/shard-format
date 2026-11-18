import {
  check,
  exactOptional,
  finite,
  integer,
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

import { creatureContract } from './creature-skeletons.ts'
import {
  CreatureVolumesSchema,
  CreatureLockSchema,
  MAX_VOLUMES,
} from './creature-volumes.ts'

import type { CreatureSkeleton, CreatureSize } from './creature-layers.ts'
import type { CreatureTrail } from './creature-skeletons.ts'
import type { CreatureVolume } from './creature-volumes.ts'
import type { GenericSchema } from 'valibot'

const ONE = 1
const MAX_SCALE = 10
const MAX_ID = 128
const MIN_TRAIL = 3
/** The head ball plus one volume per segment fit `MAX_VOLUMES`. */
const MAX_TRAIL = MAX_VOLUMES
const MAX_SPACING = 10
const id = pipe(string(), regex(/^[a-z][a-zA-Z0-9.:-]*$/u), maxLength(MAX_ID))
const scalar = pipe(number(), finite())
interface CreatureBody {
  /** Omit for a GLB with its own rig; a kit poser names its contract explicitly. */
  skeleton?: CreatureSkeleton
  /** A serpent's trail bones (ONE-FORMAT CC23); only a serpent has one. */
  trail?: CreatureTrail
  size: CreatureSize
  scale: number
  look: string
  volumes?: CreatureVolume[]
  lock?: string[]
  hits?: 'rest' | 'clip'
}
const bodyObject = strictObject({
  skeleton: exactOptional(
    picklist(['quadruped', 'biped', 'serpent'], 'Unknown creature skeleton'),
  ),
  trail: exactOptional(
    strictObject({
      count: pipe(number(), integer(), minValue(MIN_TRAIL), maxValue(MAX_TRAIL)),
      spacing: pipe(
        scalar,
        minValue(Number.MIN_VALUE),
        maxValue(MAX_SPACING),
      ),
    }),
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
  check<CreatureBody, 'A serpent has a trail row and only a serpent has one'>(
    (body: {
      readonly skeleton?: CreatureSkeleton
      readonly trail?: CreatureTrail
    }): boolean => (body.skeleton === 'serpent') === (body.trail !== undefined),
    'A serpent has a trail row and only a serpent has one',
  ),
  check<CreatureBody, 'Too many resolved creature volumes'>(
    (body: {
      readonly skeleton?: CreatureSkeleton
      readonly trail?: CreatureTrail
      readonly volumes?: readonly { readonly part: string }[]
    }): boolean => {
      // a serpent without its trail is the check above's refusal
      const defaults =
        body.skeleton === undefined ||
        (body.skeleton === 'serpent' && body.trail === undefined)
          ? []
          : creatureContract({
              skeleton: body.skeleton,
              ...(body.trail === undefined ? {} : { trail: body.trail }),
            }).volumes
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
