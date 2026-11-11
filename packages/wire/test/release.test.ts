/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion -- the fixtures mutate a cloned lock in place */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { patchProblems, releaseProblems } from '../cli/release.ts'
import { wireLockText } from '../src/lock.ts'

import type { ReleaseLock } from '../cli/release.ts'

// WR6: the release rules, each as a fixture against today's lock as the
// "released" one. An append passes; a duplicate, reused or renumbered id, a
// removal inside its window, a required-field removal, a bound change on a
// released id and a lock change on a patch tag each fail; an unreleased id
// may change freely.

type Mutable = Record<string, unknown>
/** A lock a fixture may change in place. */
interface MutableLock {
  wireMajor: number
  wireMinor: number
  [key: string]: unknown
}
const released = (): ReleaseLock => JSON.parse(wireLockText()) as ReleaseLock
const copy = (): MutableLock => structuredClone(JSON.parse(wireLockText()) as MutableLock)
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

test("today's lock against itself passes", (): void => {
  assert.deepEqual(releaseProblems(released(), released()), [])
})

test('an append with a minor bump passes', (): void => {
  const next = copy()
  next.wireMinor = 1
  fieldsOf(classNamed(next, 'animal')).push({
    id: 99,
    name: 'mood',
    node: { kind: 'uint', bits: 2 },
    default: 0,
    since: 1,
    send: 'all',
    predicted: false,
    required: false,
  })
  list(next, 'events').push({ id: 99, name: 'aurora', fields: [], since: 1 })
  assert.deepEqual(releaseProblems(released(), next), [])
})

test('an append without a minor bump fails', (): void => {
  const next = copy()
  list(next, 'events').push({ id: 99, name: 'aurora', fields: [], since: 0 })
  assert.match(
    releaseProblems(released(), next).join('\n'),
    /need WIRE_MINOR above 0/u,
  )
})

test('a duplicate id fails', (): void => {
  const next = copy()
  next.wireMinor = 1
  const [first] = list(next, 'events')
  list(next, 'events').push({ ...first, name: 'echo' })
  assert.match(
    releaseProblems(released(), next).join('\n'),
    /events holds a duplicate id/u,
  )
})

test('a reused or renumbered id fails', (): void => {
  const next = copy()
  const [first] = list(next, 'events')
  if (first !== undefined) {
    first['name'] = 'arrival'
  }
  assert.match(
    releaseProblems(released(), next).join('\n'),
    /renamed to arrival/u,
  )
})

test('a removal inside its window fails', (): void => {
  const inside = copy()
  inside['events'] = list(inside, 'events').filter(
    (entry: Mutable): boolean => entry['name'] !== 'owned',
  )
  assert.match(
    releaseProblems(released(), inside).join('\n'),
    /owned was removed inside its deprecation window/u,
  )
})

test('a removal after its window, its id reserved, passes', (): void => {
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
  ;(after['reserved'] as Mutable)['events'] = [owned?.['id']]
  assert.deepEqual(releaseProblems(base, after), [])
})

test('a reserved id used again fails', (): void => {
  const next = copy()
  next.wireMinor = 1
  ;(next['reserved'] as Mutable)['events'] = [99]
  list(next, 'events').push({ id: 99, name: 'aurora', fields: [], since: 1 })
  assert.match(
    releaseProblems(released(), next).join('\n'),
    /reserved and may not be used again/u,
  )
})

test('a required field removed fails, even deprecated', (): void => {
  const base = copy()
  fieldNamed(classNamed(base, 'script'), 'x')['deprecated'] = 0
  const next = structuredClone(base)
  next.wireMinor = 2
  const nextScript = classNamed(next, 'script')
  nextScript['fields'] = fieldsOf(nextScript).filter(
    (field: Mutable): boolean => field['name'] !== 'x',
  )
  assert.match(
    releaseProblems(base, next).join('\n'),
    /x is required and was removed/u,
  )
})

test('a bound change on a released id fails (the WR4 review)', (): void => {
  const next = copy()
  const animalX = fieldNamed(classNamed(next, 'animal'), 'x')
  ;(animalX['node'] as Mutable)['max'] = 300
  assert.match(
    releaseProblems(released(), next).join('\n'),
    /changed form or bounds/u,
  )
})

test('a bound change nested in a released command field fails', (): void => {
  const next = copy()
  const steer = fieldNamed(next['command'] as Mutable, 'steer')
  const keyX = fieldNamed(steer['node'] as Mutable, 'keyX')
  ;(keyX['node'] as Mutable)['bits'] = 10
  assert.match(
    releaseProblems(released(), next).join('\n'),
    /command#3 steer.*keyX.* changed form or bounds/u,
  )
})

test('retyping an id added since the release passes', (): void => {
  const base = copy()
  base.wireMinor = 1
  list(base, 'events').push({ id: 99, name: 'aurora', fields: [], since: 1 })
  const next = structuredClone(base)
  const aurora = list(next, 'events').find(
    (entry: Mutable): boolean => entry['id'] === 99,
  )
  if (aurora !== undefined) {
    aurora['fields'] = [
      {
        id: 1,
        name: 'hue',
        node: { kind: 'uint', bits: 8 },
        default: 0,
        since: 1,
      },
    ]
  }
  assert.deepEqual(releaseProblems(released(), next), [])
})

test('a limit change needs a major', (): void => {
  const next = copy()
  ;(next['tableLimits'] as Mutable)['maxNodes'] = 8192
  assert.match(releaseProblems(released(), next).join('\n'), /WIRE_MAJOR bump/u)
  next.wireMajor = 2
  assert.deepEqual(releaseProblems(released(), next), [])
})

test('a lock change on a patch tag fails; on a minor tag it is the release', (): void => {
  assert.equal(patchProblems('wire-v1.0.1', 'a', 'b').length, 1)
  assert.deepEqual(patchProblems('wire-v1.0.1', 'a', 'a'), [])
  assert.deepEqual(patchProblems('wire-v1.1.0', 'a', 'b'), [])
})
