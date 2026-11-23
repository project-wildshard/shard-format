import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  check,
  integer,
  looseObject,
  number,
  object,
  optional,
  pipe,
  regex,
  strictObject,
  string,
  transform,
} from 'valibot'

import { diffOf, lockOf, only } from '../tools/format-diff-fixture.ts'
import { formatDiff } from './format-diff.ts'

import type { Expected, Module } from '../tools/format-diff-fixture.ts'

// SHARD-COMPAT FE2's done-when, part two: objects, pipes, defaults,
// exports, constants, deprecations and the chain id.

const FLOOR = 1
const RAISED_FLOOR = 2
const MAX_SIZE = 10
const BIGGER = 20
const SMALLER = 5

const sized = (size: number): Module => ({
  Shard: strictObject({ size: optional(number(), size) }),
})
const above = (floor: number): Module => ({
  Spec: pipe(
    number(),
    check((value: number): boolean => value > floor),
  ),
})
const atLeast = (floor: number): Module => ({
  Spec: pipe(
    number(),
    check((value: number): boolean => value >= floor),
  ),
})
const trimmed = pipe(
  string(),
  transform((value: string): string => value.trim()),
)

// [title, before, after, expected]
const MORE: readonly (readonly [string, Module, Module, Expected])[] = [
  [
    'strict object loosened',
    { Spec: strictObject({}) },
    { Spec: looseObject({}) },
    ['./sample#Spec', 'additive'],
  ],
  [
    'object made strict',
    { Spec: object({}) },
    { Spec: strictObject({}) },
    ['./sample#Spec', 'breaking'],
  ],
  [
    'regex changed',
    { Spec: pipe(string(), regex(/^a/u)) },
    { Spec: pipe(string(), regex(/^b/u)) },
    ['./sample#Spec', 'review'],
  ],
  [
    'predicate code changed',
    above(FLOOR),
    atLeast(FLOOR),
    ['./sample#Spec', 'review'],
  ],
  [
    'validation added',
    { Spec: number() },
    { Spec: pipe(number(), integer()) },
    ['./sample#Spec', 'breaking'],
  ],
  [
    'validation removed',
    { Spec: pipe(number(), integer()) },
    { Spec: number() },
    ['./sample#Spec', 'additive'],
  ],
  [
    'default changed',
    sized(FLOOR),
    sized(RAISED_FLOOR),
    ['./sample#Shard.size', 'review'],
  ],
  [
    'transform added',
    { Spec: string() },
    { Spec: trimmed },
    ['./sample#Spec', 'review'],
  ],
  ['new export', {}, { Extra: string() }, ['./sample#Extra', 'additive']],
  ['export removed', { Extra: string() }, {}, ['./sample#Extra', 'breaking']],
  [
    'function export added',
    {},
    { parse: (): number => FLOOR },
    ['./sample#parse', 'additive'],
  ],
  [
    'function export removed',
    { parse: (): number => FLOOR },
    {},
    ['./sample#parse', 'breaking'],
  ],
  [
    'limit constant raised',
    { MAX_SIZE },
    { MAX_SIZE: BIGGER },
    ['./sample#MAX_SIZE', 'additive'],
  ],
  [
    'limit constant lowered',
    { MAX_SIZE },
    { MAX_SIZE: SMALLER },
    ['./sample#MAX_SIZE', 'breaking'],
  ],
  [
    'list constant grows',
    { KINDS: ['a'] },
    { KINDS: ['a', 'b'] },
    ['./sample#KINDS', 'additive'],
  ],
  [
    'list constant shrinks',
    { KINDS: ['a', 'b'] },
    { KINDS: ['a'] },
    ['./sample#KINDS', 'breaking', 'map'],
  ],
]

describe('format-diff classifies each seeded pipe, export and constant change', (): void => {
  for (const [title, before, after, expected] of MORE) {
    it(title, (): void => {
      assert.deepEqual(only(diffOf(before, after)), expected)
    })
  }
})

describe('format-diff reads code, deprecations and the chain id', (): void => {
  it('a predicate whose comment changed is no change', (): void => {
    const floor = FLOOR
    const commented = {
      Spec: pipe(
        number(),
        check(
          (value: number): boolean =>
            // Why: a docs-only edit
            value > floor,
        ),
      ),
    }
    assert.deepEqual(diffOf(above(FLOOR), commented).changes, [])
  })

  it('a new deprecation is a deprecation; deleting one is a break', (): void => {
    const row = { id: 'requires.sdk', since: '0.1.0.1', migration: 'none' }
    const listed = lockOf({}, { 'requires.sdk': row })
    const empty = lockOf({})
    const added = formatDiff(empty, listed)
    const gone = formatDiff(listed, empty)
    assert.deepEqual(only(added), [
      './deprecations#requires.sdk',
      'deprecation',
    ])
    assert.deepEqual(only(gone), ['./deprecations#requires.sdk', 'breaking'])
  })

  it('a moved chain id is reported beside the changes', (): void => {
    const report = formatDiff(lockOf({}), { ...lockOf({}), chainId: 'next' })
    assert.deepEqual(report.chain, { before: 'chain', after: 'next' })
    assert.equal(report.worst, 'none')
  })
})
