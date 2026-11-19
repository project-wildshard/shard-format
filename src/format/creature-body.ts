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

import {
  CreatureAttachmentsSchema,
  attachmentsResolve,
  volumeChannelsDeclared,
} from './creature-attachments.ts'
import {
  CreatureChannelBindSchema,
  CreatureChannelsSchema,
  CreatureLookSwapSchema,
  channelsDeclared,
} from './creature-channels.ts'
import { creatureContract } from './creature-skeletons.ts'
import {
  CreatureVolumesSchema,
  CreatureLockSchema,
  MAX_VOLUMES,
} from './creature-volumes.ts'

import type { CreatureAttachment } from './creature-attachments.ts'
import type {
  CreatureChannel,
  CreatureChannelBind,
  CreatureLookSwap,
} from './creature-channels.ts'
import type { CreatureSkeleton, CreatureSize } from './creature-layers.ts'
import type { BipedStance, CreatureTrail } from './creature-skeletons.ts'
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
  /** A biped's stance (ONE-FORMAT CC58); `horizontal` pitches the spine forward and needs a tail `trail`. */
  stance?: BipedStance
  /** A serpent's trail bones (ONE-FORMAT CC23), or a horizontal biped's tail (CC58); no other body has one. */
  trail?: CreatureTrail
  size: CreatureSize
  scale: number
  look: string
  volumes?: CreatureVolume[]
  lock?: string[]
  hits?: 'rest' | 'clip'
  /** ONE-FORMAT CC28: at most four actor channels, in wire order (animal fields 25 to 28). */
  channels?: CreatureChannel[]
  /** Material tint, emissive and opacity that follow channels. */
  bind?: CreatureChannelBind
  /** A second look drawn while a channel is high. */
  swap?: CreatureLookSwap
  /** ONE-FORMAT CC30a: at most eight parts hung on sockets, shown by channel, hidden by a broken part. */
  attachments?: CreatureAttachment[]
}
const trailCount = pipe(
  number(),
  integer(),
  minValue(MIN_TRAIL),
  maxValue(MAX_TRAIL),
)
const trailSpacing = pipe(
  scalar,
  minValue(Number.MIN_VALUE),
  maxValue(MAX_SPACING),
)
const trailObject = strictObject({ count: trailCount, spacing: trailSpacing })
const bodyObject = strictObject({
  skeleton: exactOptional(
    picklist(['quadruped', 'biped', 'serpent'], 'Unknown creature skeleton'),
  ),
  stance: exactOptional(
    picklist(['upright', 'horizontal'], 'Unknown biped stance'),
  ),
  trail: exactOptional(trailObject),
  size: picklist(
    ['tiny', 'small', 'medium', 'large', 'giant'],
    'Unknown creature size',
  ),
  scale: pipe(scalar, minValue(Number.MIN_VALUE), maxValue(MAX_SCALE)),
  look: id,
  volumes: exactOptional(CreatureVolumesSchema),
  lock: exactOptional(CreatureLockSchema),
  hits: exactOptional(picklist(['rest', 'clip'])),
  channels: exactOptional(CreatureChannelsSchema),
  bind: exactOptional(CreatureChannelBindSchema),
  swap: exactOptional(CreatureLookSwapSchema),
  attachments: exactOptional(CreatureAttachmentsSchema),
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
  check<CreatureBody, 'Only a biped has a stance'>(
    (body: {
      readonly skeleton?: CreatureSkeleton
      readonly stance?: BipedStance
    }): boolean => body.stance === undefined || body.skeleton === 'biped',
    'Only a biped has a stance',
  ),
  check<CreatureBody, 'A horizontal biped has a tail trail row'>(
    (body: {
      readonly stance?: BipedStance
      readonly trail?: CreatureTrail
    }): boolean => body.stance !== 'horizontal' || body.trail !== undefined,
    'A horizontal biped has a tail trail row',
  ),
  check<CreatureBody, 'A serpent has a trail row and only a serpent has one'>(
    (body: {
      readonly skeleton?: CreatureSkeleton
      readonly stance?: BipedStance
      readonly trail?: CreatureTrail
    }): boolean =>
      (body.skeleton === 'biped' && body.stance === 'horizontal') ||
      (body.skeleton === 'serpent') === (body.trail !== undefined),
    'A serpent has a trail row and only a serpent has one',
  ),
  check<CreatureBody, 'Too many resolved creature volumes'>(
    (body: {
      readonly skeleton?: CreatureSkeleton
      readonly stance?: BipedStance
      readonly trail?: CreatureTrail
      readonly volumes?: readonly { readonly part: string }[]
    }): boolean => {
      // A serpent or horizontal biped without its trail is a check above's refusal
      const defaults =
        body.skeleton === undefined ||
        ((body.skeleton === 'serpent' || body.stance === 'horizontal') &&
          body.trail === undefined)
          ? []
          : creatureContract({
              skeleton: body.skeleton,
              ...(body.stance === undefined ? {} : { stance: body.stance }),
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
  check<CreatureBody, 'A creature binds an undeclared channel'>(
    channelsDeclared,
    'A creature binds an undeclared channel',
  ),
  check<CreatureBody, 'A part breaks into an undeclared channel'>(
    volumeChannelsDeclared,
    'A part breaks into an undeclared channel',
  ),
  check<CreatureBody, 'A creature attachment does not resolve'>(
    attachmentsResolve,
    'A creature attachment does not resolve',
  ),
)

export { CreatureBodySchema }
export type { CreatureBody }
