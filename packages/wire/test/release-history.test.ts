/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/no-unsafe-type-assertion -- the fixtures mutate a cloned lock in place */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { releaseProblems, reuseProblems } from '../cli/release.ts'
import {
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
} from './helpers/release.ts'

import type { Mutable } from './helpers/release.ts'

// WR6, the rest of the release rules (after the Opus review): enums only
// append, a removal reserves its id and waits 14 days, history is fixed, a
// new grammar kind or a removed required field needs a major, versions never
// fall, and an id an earlier release held keeps its meaning.

test('an enum may append a value with a minor bump, never reorder', (): void => {
  const next = copy()
  next.wireMinor = 1
  const node = stateNode(next)
  node['values'] = [...(node['values'] as string[]), 'sleep']
  assert.deepEqual(releaseProblems(released(), next), [])
  const shuffled = copy()
  shuffled.wireMinor = 1
  const values = stateNode(shuffled)['values'] as string[]
  stateNode(shuffled)['values'] = values.toReversed()
  assert.match(
    releaseProblems(released(), shuffled).join('\n'),
    /reordered or dropped an enum value/u,
  )
})

test('a removal past its window that does not reserve its id fails; so does a shrinking reserved list', (): void => {
  const { base, after } = ownedRemoved()
  assert.match(
    releaseProblems(base, after, PAST_WINDOW).join('\n'),
    /removed without joining reserved/u,
  )
  const shrunk = copy()
  ;(shrunk['reserved'] as Mutable)['events'] = [77]
  const later = structuredClone(shrunk)
  later.wireMinor = 1
  ;(later['reserved'] as Mutable)['events'] = []
  assert.match(
    releaseProblems(shrunk, later).join('\n'),
    /left the reserved list/u,
  )
})

test('a removal inside 14 days of its deprecation fails', (): void => {
  const { base, after, id } = ownedRemoved()
  ;(after['reserved'] as Mutable)['events'] = [id]
  const soon = { releasedAt: (): number => 0, now: 13 * DAY }
  assert.match(
    releaseProblems(base, after, soon).join('\n'),
    /inside its deprecation window/u,
  )
})

test('history is fixed: since never moves, deprecated is never dropped', (): void => {
  const next = copy()
  next.wireMinor = 1
  fieldNamed(classNamed(next, 'animal'), 'x')['since'] = 1
  assert.match(
    releaseProblems(released(), next).join('\n'),
    /changed its since/u,
  )
  const base = copy()
  fieldNamed(classNamed(base, 'animal'), 'yaw')['deprecated'] = 0
  const later = copy()
  later.wireMinor = 1
  assert.match(
    releaseProblems(base, later).join('\n'),
    /moved or dropped its deprecation/u,
  )
})

test('a new grammar kind needs a major', (): void => {
  const next = copy()
  next.wireMinor = 1
  fieldsOf(classNamed(next, 'animal')).push({
    id: 98,
    name: 'route',
    node: { kind: 'path', points: 4 },
    default: 0,
    since: 1,
    send: 'all',
    predicted: false,
    required: false,
  })
  assert.match(
    releaseProblems(released(), next).join('\n'),
    /node kind path is new/u,
  )
})

test('a major may remove a required field and change limits; versions never fall', (): void => {
  const next = copy()
  next.wireMajor = 2
  next.wireMinor = 0
  const script = classNamed(next, 'script')
  script['fields'] = fieldsOf(script).filter(
    (field: Mutable): boolean => field['name'] !== 'x',
  )
  ;(next['tableLimits'] as Mutable)['maxNodes'] = 8192
  assert.deepEqual(releaseProblems(released(), next), [])
  const lower = copy()
  lower.wireMajor = 0
  assert.match(releaseProblems(released(), lower).join('\n'), /went down/u)
})

test('an act arm appended with a minor passes', (): void => {
  const next = copy()
  next.wireMinor = 1
  const arms = (next['acts'] as Mutable)['arms'] as Mutable[]
  arms.push({ id: 99, name: 'wave', fields: [], since: 1 })
  assert.deepEqual(releaseProblems(released(), next), [])
})

test('an id an earlier release held never comes back meaning something else', (): void => {
  const next = copy()
  next.wireMinor = 2
  const [first] = list(next, 'events')
  if (first !== undefined) {
    first['name'] = 'arrival'
  }
  assert.match(
    reuseProblems(released(), next).join('\n'),
    /renamed to arrival/u,
  )
})
