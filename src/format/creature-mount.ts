import {
  boolean,
  check,
  exactOptional,
  finite,
  maxValue,
  minValue,
  number,
  pipe,
  strictObject,
} from 'valibot'

import { CREATURE_SKELETONS } from './creature-skeletons.ts'
import { CreatureSocketNameSchema } from './creature-volumes.ts'

import type { CreatureSkeleton } from './creature-layers.ts'
import type { GenericSchema } from 'valibot'

/** The seat socket both kit skeletons name. */
const DEFAULT_SEAT = 'seat'
/** Metres per second: past a galloping horse with room for a fast flyer. */
const MAX_GAIT = 40
const ZERO = 0
const PREVIOUS = 1

/** Ground speeds in metres per second, slowest first; trot and canter are optional steps between. */
interface MountGaits {
  walk: number
  trot?: number
  canter?: number
  gallop: number
}
/**
 * ONE-FORMAT CC40a (Q27, Q-S3, Q-C7, Q-CC42): a `mount` row makes any creature rideable by the one riding primitive.
 * `seat` names the socket the rider sits at (default `seat`), `fly` lets it take off on its species `flight` row.
 */
interface CreatureMount {
  seat?: string
  gaits: MountGaits
  fly?: boolean
}

const gait = pipe(number(), finite(), minValue(ZERO), maxValue(MAX_GAIT))
const gaitsObject = strictObject(
  {
    walk: gait,
    trot: exactOptional(gait),
    canter: exactOptional(gait),
    gallop: gait,
  },
  'Unknown mount gait',
)
function rising(gaits: Readonly<MountGaits>): boolean {
  const steps = [gaits.walk, gaits.trot, gaits.canter, gaits.gallop].filter(
    (step): step is number => step !== undefined,
  )
  return steps.every(
    (step: number, at: number): boolean =>
      at === ZERO || step > (steps[at - PREVIOUS] ?? step),
  )
}
const CreatureMountSchema: GenericSchema<CreatureMount> = strictObject(
  {
    seat: exactOptional(CreatureSocketNameSchema),
    gaits: pipe(
      gaitsObject,
      check(rising, 'Mount gaits rise from walk to gallop'),
    ),
    fly: exactOptional(boolean()),
  },
  'Unknown mount field',
)

/** The parts of a species row the mount rules read. */
interface MountedSpecies {
  readonly id: string
  readonly mount?: { readonly seat?: string; readonly fly?: boolean }
  readonly flight?: unknown
  readonly body?: {
    readonly skeleton?: CreatureSkeleton
    readonly volumes?: readonly { readonly part: string }[]
  }
}

function seatKnown(seat: string, body: MountedSpecies['body']): boolean {
  const parts = (body?.volumes ?? []).map(
    (volume: { readonly part: string }): string => volume.part,
  )
  if (parts.includes(seat)) {
    return true
  }
  // A GLB with its own rig names its sockets in its skin; admission checks the seat there.
  return (
    body?.skeleton === undefined ||
    Object.hasOwn(CREATURE_SKELETONS[body.skeleton].sockets, seat)
  )
}

/** Each mount's references, as named refusals: a body to sit on, a seat it has, and a flight row to fly with. */
function creatureMountRules(species: readonly MountedSpecies[]): string[] {
  return species.flatMap((row: MountedSpecies): string[] => {
    const { mount, body, id } = row
    if (mount === undefined) {
      return []
    }
    const seat = mount.seat ?? DEFAULT_SEAT
    return [
      ...(body === undefined ? [`Mount ${id} needs a body`] : []),
      ...(body !== undefined && !seatKnown(seat, body)
        ? [`Unknown mount seat ${seat} on ${id}`]
        : []),
      ...(mount.fly === true && row.flight === undefined
        ? [`Flying mount ${id} needs a flight row`]
        : []),
    ]
  })
}

export type { CreatureMount, MountGaits }
export { CreatureMountSchema, DEFAULT_SEAT, creatureMountRules }
