import {
  array,
  boolean,
  check,
  exactOptional,
  finite,
  maxLength,
  maxEntries,
  maxValue,
  minLength,
  minValue,
  number,
  picklist,
  pipe,
  regex,
  record,
  strictObject,
  string,
  tuple,
  union,
} from 'valibot'

import { HuntTuningSchema } from './speciesPrograms.ts'

import type { SpeciesData } from './speciesPrograms.ts'
import type { GenericSchema } from 'valibot'

/** Labels for quest and journal filters; these never choose mechanics. */
type CreatureType =
  | 'beast'
  | 'humanoid'
  | 'giant'
  | 'dragonkin'
  | 'undead'
  | 'elemental'
  | 'construct'
  | 'insect'
  | 'aquatic'
  | 'critter'
  | 'aberration'
type CreatureSkeleton = 'quadruped' | 'biped'
type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'giant'
type CreatureReaction = 'passive' | 'skittish' | 'neutral' | 'aggressive'
type CreatureTuningScalar = number | boolean | string
type CreatureTuningValue =
  | CreatureTuningScalar
  | CreatureTuningScalar[]
  | Record<string, CreatureTuningScalar>
type CreatureTuning = Record<string, CreatureTuningValue>

interface CreatureBody {
  /** Omit for a GLB with its own rig; a kit poser names its contract explicitly. */
  skeleton?: CreatureSkeleton
  size: CreatureSize
  scale: number
  look: string
}
/** The spawn supplies home position; these numbers control its return policy. */
interface CreatureTemperament {
  brain: string
  reaction: CreatureReaction
  leash: number
  assist: number
  home: { speed: number; stop: number }
  pack?: boolean
  territorial?: number
  ambush?: boolean
  flee?: number
  tuning?: NonNullable<SpeciesData['tuning']> | CreatureTuning
}
interface CreatureSenses {
  notice: number
  sight?: { range: number; cone: number; graze?: number }
  hearing?: { still: number; crouch: number; walk: number; sprint: number }
  reveal?: number
}
/** Ordered strike-row references. A scalar range means zero through that radius. */
interface CreatureAbility {
  use: string
  range: number | [number, number]
  cooldown: number
  weight: number
  hpBelow?: number
  damage?: number
  speed?: number
  windup?: number
  duration?: number
}
interface CreaturePresentation {
  blood: boolean
  sounds: {
    call?: string
    hurt?: string
    callVariants?: string[]
    callEvery?: [number, number]
  }
}
/** Additive fields: absence is preserved without injecting a default layer. */
interface CreatureLayers {
  type?: CreatureType
  body?: CreatureBody
  temperament?: CreatureTemperament
  senses?: CreatureSenses
  abilities?: CreatureAbility[]
  presentation?: CreaturePresentation
}

const ZERO = 0
const ONE = 1
const MAX_ID = 128
const MAX_SOUND = 4096
const MAX_RADIUS = 500
const MAX_SPEED = 15
const MAX_TIME = 86_400
const MAX_AMOUNT = 10_000_000
const MAX_SCALE = 10
const MAX_CALLS = 32
const MAX_TUNING_FIELDS = 64

const id = pipe(string(), regex(/^[a-z][a-zA-Z0-9.:-]*$/u), maxLength(MAX_ID))
const sound = pipe(string(), minLength(ONE), maxLength(MAX_SOUND))
const scalar = pipe(number(), finite())
const radius = pipe(scalar, minValue(ZERO), maxValue(MAX_RADIUS))
const speed = pipe(scalar, minValue(ZERO), maxValue(MAX_SPEED))
const unit = pipe(scalar, minValue(ZERO), maxValue(ONE))
const time = pipe(scalar, minValue(ZERO), maxValue(MAX_TIME))
const amount = pipe(scalar, minValue(ZERO), maxValue(MAX_AMOUNT))
const orderedRadius = pipe(
  tuple([radius, radius]),
  check<[number, number], 'Ordered creature ability range'>(
    ([near, far]: readonly [number, number]): boolean => near <= far,
    'Ordered creature ability range',
  ),
)
const orderedTime = pipe(
  tuple([time, time]),
  check<[number, number], 'Ordered creature call interval'>(
    ([near, far]: readonly [number, number]): boolean => near <= far,
    'Ordered creature call interval',
  ),
)
const tuningNumber = pipe(scalar, minValue(-MAX_AMOUNT), maxValue(MAX_AMOUNT))
const tuningScalar = union([tuningNumber, boolean(), sound])
const tuningList = pipe(array(tuningScalar), maxLength(MAX_CALLS))
const tuningObject = pipe(
  record(id, tuningScalar),
  maxEntries(MAX_TUNING_FIELDS),
)
const tuningValue = union([tuningScalar, tuningList, tuningObject])
const brainTuning = pipe(record(id, tuningValue), maxEntries(MAX_TUNING_FIELDS))
const tuning = union([HuntTuningSchema, brainTuning])

/** Schemas are separately bounded so their defining declaration stays small. */
const CreatureTypeSchema: GenericSchema<CreatureType> = picklist(
  [
    'beast',
    'humanoid',
    'giant',
    'dragonkin',
    'undead',
    'elemental',
    'construct',
    'insect',
    'aquatic',
    'critter',
    'aberration',
  ],
  'Unknown creature type',
)
const CreatureBodySchema: GenericSchema<CreatureBody> = strictObject({
  skeleton: exactOptional(
    picklist(['quadruped', 'biped'], 'Unknown creature skeleton'),
  ),
  size: picklist(
    ['tiny', 'small', 'medium', 'large', 'giant'],
    'Unknown creature size',
  ),
  scale: pipe(scalar, minValue(Number.MIN_VALUE), maxValue(MAX_SCALE)),
  look: id,
})
const CreatureTemperamentSchema: GenericSchema<CreatureTemperament> =
  strictObject({
    brain: id,
    reaction: picklist(
      ['passive', 'skittish', 'neutral', 'aggressive'],
      'Unknown creature reaction',
    ),
    leash: radius,
    assist: radius,
    home: strictObject({ speed, stop: radius }),
    pack: exactOptional(boolean()),
    territorial: exactOptional(radius),
    ambush: exactOptional(boolean()),
    flee: exactOptional(unit),
    tuning: exactOptional(tuning),
  })
const sight = strictObject({
  range: radius,
  cone: pipe(scalar, minValue(ZERO), maxValue(Math.PI)),
  graze: exactOptional(radius),
})
const hearing = strictObject({
  still: radius,
  crouch: radius,
  walk: radius,
  sprint: radius,
})
const CreatureSensesSchema: GenericSchema<CreatureSenses> = strictObject(
  {
    notice: radius,
    sight: exactOptional(sight),
    hearing: exactOptional(hearing),
    reveal: exactOptional(radius),
  },
  'Unknown creature sense',
)
const CreatureAbilitySchema: GenericSchema<CreatureAbility> = strictObject({
  use: id,
  range: union([radius, orderedRadius]),
  cooldown: time,
  weight: amount,
  hpBelow: exactOptional(unit),
  damage: exactOptional(amount),
  speed: exactOptional(amount),
  windup: exactOptional(time),
  duration: exactOptional(time),
})
const callVariants = pipe(array(sound), maxLength(MAX_CALLS))
const CreaturePresentationSchema: GenericSchema<CreaturePresentation> =
  strictObject({
    blood: boolean(),
    sounds: strictObject({
      call: exactOptional(sound),
      hurt: exactOptional(sound),
      callVariants: exactOptional(callVariants),
      callEvery: exactOptional(orderedTime),
    }),
  })

export {
  CreatureTypeSchema,
  CreatureBodySchema,
  CreatureTemperamentSchema,
  CreatureSensesSchema,
  CreatureAbilitySchema,
  CreaturePresentationSchema,
}
export type {
  CreatureType,
  CreatureSkeleton,
  CreatureSize,
  CreatureReaction,
  CreatureBody,
  CreatureTemperament,
  CreatureSenses,
  CreatureAbility,
  CreaturePresentation,
  CreatureLayers,
  CreatureTuningScalar,
  CreatureTuningValue,
  CreatureTuning,
}
