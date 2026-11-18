/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion -- the fixtures mutate a cloned lock in place */
import { wireLockText } from '../../src/lock.ts'

import type { ReleaseLock } from '../../cli/release.ts'

// The release-rule fixtures (WR6): today's lock as the "released" one, a
// clone a fixture may bend in place, and finders for the entries they bend.

type Mutable = Record<string, unknown>
const DAY = 86_400
/** When every minor was tagged in the long-ago clock: the epoch. */
const EPOCH = 0
/** How many days later "now" is in the long-ago clock. */
const MONTH_DAYS = 30
/** A clock where every minor was tagged long ago. */
const PAST_WINDOW = { releasedAt: (): number => EPOCH, now: MONTH_DAYS * DAY }
/** A lock a fixture may change in place. */
interface MutableLock {
  wireMajor: number
  wireMinor: number
  [key: string]: unknown
}
/** Every `since` in a lock's tree, set to 0. */
const sinceZero = (node: unknown): void => {
  if (typeof node !== 'object' || node === null) {
    return
  }
  const entry = node as Mutable
  if (typeof entry['since'] === 'number') {
    entry['since'] = 0
  }
  for (const child of Object.values(entry)) {
    sinceZero(child)
  }
}
/** Today's lock as the fixtures' release: minor 0, every id since 0, whatever minor the wire is at. */
const today = (): MutableLock => {
  const lock = JSON.parse(wireLockText()) as MutableLock
  lock.wireMinor = 0
  sinceZero(lock)
  return lock
}
const released = (): ReleaseLock => today()
const copy = (): MutableLock => today()
/** A field of `entry` by name; a fixture's target must exist. */
const fieldNamed = (entry: Mutable, name: string): Mutable => {
  const found = (entry['fields'] as Mutable[]).find(
    (field: Mutable): boolean => field['name'] === name,
  )
  if (found === undefined) {
    throw new Error(`no field ${name}`)
  }
  return found
}
const list = (lock: Mutable, key: string): Mutable[] => lock[key] as Mutable[]
const classNamed = (lock: Mutable, name: string): Mutable => {
  const found = list(lock, 'classes').find(
    (entry: Mutable): boolean => entry['name'] === name,
  )
  if (found === undefined) {
    throw new Error(`no class ${name}`)
  }
  return found
}
const fieldsOf = (entry: Mutable): Mutable[] => entry['fields'] as Mutable[]
/** An enum field to bend: the animal's `state`. */
const stateNode = (lock: Mutable): Mutable =>
  fieldNamed(classNamed(lock, 'animal'), 'state')['node'] as Mutable

/** A release that deprecated the `owned` event at minor 0, and a minor 1 that removed it (its id not yet reserved). */
const ownedRemoved = (): {
  readonly base: MutableLock
  readonly after: MutableLock
  readonly id: unknown
} => {
  const base = copy()
  const owned = list(base, 'events').find(
    (entry: Mutable): boolean => entry['name'] === 'owned',
  )
  if (owned !== undefined) {
    owned['deprecated'] = 0
  }
  const after = structuredClone(base)
  after.wireMinor = 1
  after['events'] = list(after, 'events').filter(
    (entry: Mutable): boolean => entry['name'] !== 'owned',
  )
  return { base, after, id: owned?.['id'] }
}

export {
  classNamed,
  copy,
  DAY,
  fieldNamed,
  fieldsOf,
  list,
  ownedRemoved,
  PAST_WINDOW,
  released,
  stateNode,
  type Mutable,
  type MutableLock,
}
