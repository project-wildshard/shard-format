import {
  array,
  check,
  finite,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  pipe,
  regex,
  strictObject,
  string,
  tuple,
} from 'valibot'

import type { GenericSchema } from 'valibot'

/** Metres per second: a walking patrol, up to a run. */
const MAX_SPEED = 15
/** Metres: the cell's half-width. */
const MAX_COORD = 250
const MAX_RADIUS = 250
const MIN_RADIUS = 0.5
const MIN_STOPS = 2
const MAX_STOPS = 32
const MAX_MEMBERS = 16
const MAX_ID = 128
const MAX_PATROLS = 64
const MIN_SPEED = 0.1
const ONE = 1
const NONE = 0

/**
 * ONE-FORMAT OF37a (Q-S10: a separate patrol primitive). A patrol walks its members round `route` at `speed`, in step;
 * a player within `engage` metres of any member draws the patrol into the fight, and once every member is more than
 * `leash` metres from the route it gives up and walks back to where it left the route. Its members are creature spawns
 * that belong to no other group. Nalati's `encounter.patrol` and timed encounters move onto it (OF37b).
 */
interface CreaturePatrol {
  id: string
  members: string[]
  route: [number, number, number][]
  speed: number
  engage: number
  leash: number
}

const id = pipe(string(), regex(/^[a-z][a-z0-9.:-]*$/u), maxLength(MAX_ID))
const coord = pipe(
  number(),
  finite(),
  minValue(-MAX_COORD),
  maxValue(MAX_COORD),
)
const radius = pipe(
  number(),
  finite(),
  minValue(MIN_RADIUS),
  maxValue(MAX_RADIUS),
)
const stop = tuple([coord, coord, coord])
const route = pipe(
  array(stop),
  minLength(MIN_STOPS, 'A patrol route needs two stops'),
  maxLength(MAX_STOPS),
)
const members = pipe(
  array(id),
  minLength(ONE, 'A patrol needs a member'),
  maxLength(MAX_MEMBERS),
)
const speed = pipe(number(), finite(), minValue(MIN_SPEED), maxValue(MAX_SPEED))

/** A patrol as the rules read it. */
interface PatrolReading {
  readonly id: string
  readonly members: readonly string[]
  readonly engage: number
  readonly leash: number
}
interface GroupReading {
  readonly members: readonly string[]
}

function leashOutreaches(row: PatrolReading): boolean {
  return row.leash >= row.engage
}
const patrol = pipe(
  strictObject({ id, members, route, speed, engage: radius, leash: radius }),
  check<CreaturePatrol, string>(
    leashOutreaches,
    'A patrol leash reaches at least its engage radius',
  ),
)
const CreaturePatrolsSchema: GenericSchema<CreaturePatrol[]> = pipe(
  array(patrol),
  maxLength(MAX_PATROLS),
)

/** Each member once across the patrols and groups: the members already taken by a group or an earlier patrol. */
function memberErrors(
  row: PatrolReading,
  known: ReadonlySet<string>,
  taken: Set<string>,
): string[] {
  const errors: string[] = []
  for (const member of row.members) {
    if (!known.has(member)) {
      errors.push('declared patrol member')
    }
    if (taken.has(member)) {
      errors.push('a patrol member belongs to one controller')
    }
    taken.add(member)
  }
  return errors
}
/** Patrol references: unique ids, members that are spawns, and no spawn in two patrols or in a group too. */
function patrolRules(
  patrols: readonly PatrolReading[],
  spawns: readonly Readonly<{ id: string }>[],
  groups: readonly GroupReading[],
): string[] {
  const known = new Set(
    spawns.map((row: Readonly<{ id: string }>): string => row.id),
  )
  const taken = new Set(
    groups.flatMap((row: GroupReading): readonly string[] => row.members),
  )
  const ids = new Set(patrols.map((row: PatrolReading): string => row.id))
  const errors = ids.size === patrols.length ? [] : ['unique patrol ids']
  return [
    ...errors,
    ...patrols.flatMap((row: PatrolReading): string[] =>
      memberErrors(row, known, taken),
    ),
  ]
}

/** Whether the patrols' references hold (`patrolRules` finds nothing). */
function patrolsAdmitted(
  patrols: readonly PatrolReading[],
  spawns: readonly Readonly<{ id: string }>[],
  groups: readonly GroupReading[],
): boolean {
  return patrolRules(patrols, spawns, groups).length === NONE
}

export type { CreaturePatrol }
export { CreaturePatrolsSchema, patrolRules, patrolsAdmitted }
