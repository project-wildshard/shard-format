import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  exactOptional,
  literal,
  maxLength,
  minLength,
  minValue,
  nullable,
  number,
  optional,
  picklist,
  pipe,
  strictObject,
  string,
  variant,
} from 'valibot'

import { diffOf, only } from '../tools/format-diff-fixture.ts'

import type { Expected, Module } from '../tools/format-diff-fixture.ts'

// SHARD-COMPAT FE2's done-when, part one: shapes. One row per change kind:
// the module before, after, and the one change (path, kind, op) it gives.
// Pipes, constants, exports and deprecations: format-diff-more.test.ts.

const NAME_MAX = 32
const WIDER = 64
const NARROWER = 16
const FLOOR = 1
const RAISED_FLOOR = 2

const Name = pipe(string(), maxLength(NAME_MAX))
const Pos = pipe(number(), minValue(FLOOR))
const shard = (fields: Module): Module => ({
  Shard: strictObject({ name: Name, ...fields }),
})
const Boss = strictObject({ kind: literal('boss'), hp: number() })
const Add = strictObject({ kind: literal('add'), count: number() })
const Minion = strictObject({ kind: literal('minion') })
const Fight = variant('kind', [Boss, Add])
const Look = strictObject({ sky: string(), fog: number() })
const Label = exactOptional(string())

// [title, before, after, expected]
const SHAPES: readonly (readonly [string, Module, Module, Expected])[] = [
  [
    'new optional field',
    shard({}),
    shard({ tag: exactOptional(string()) }),
    ['./sample#Shard.tag', 'additive'],
  ],
  [
    'new required field',
    shard({}),
    shard({ tag: string() }),
    ['./sample#Shard.tag', 'breaking', 'fill'],
  ],
  [
    'field removed',
    shard({ tag: string() }),
    shard({}),
    ['./sample#Shard.tag', 'breaking', 'drop'],
  ],
  [
    'field renamed',
    shard({ tag: number() }),
    shard({ label: number() }),
    ['./sample#Shard.tag', 'breaking', 'rename'],
  ],
  [
    'field moved to another object',
    {
      Shard: strictObject({
        near: strictObject({ hp: Pos }),
        far: strictObject({}),
      }),
    },
    {
      Shard: strictObject({
        near: strictObject({}),
        far: strictObject({ hp: Pos }),
      }),
    },
    ['./sample#Shard.near.hp', 'breaking', 'moveSection'],
  ],
  [
    'maxLength raised',
    shard({}),
    { Shard: strictObject({ name: pipe(string(), maxLength(WIDER)) }) },
    ['./sample#Shard.name', 'additive'],
  ],
  [
    'maxLength lowered',
    shard({}),
    { Shard: strictObject({ name: pipe(string(), maxLength(NARROWER)) }) },
    ['./sample#Shard.name', 'breaking'],
  ],
  [
    'minLength raised',
    { Spec: pipe(string(), minLength(FLOOR)) },
    { Spec: pipe(string(), minLength(RAISED_FLOOR)) },
    ['./sample#Spec', 'breaking'],
  ],
  [
    'minValue lowered',
    { Spec: pipe(number(), minValue(RAISED_FLOOR)) },
    { Spec: Pos },
    ['./sample#Spec', 'additive'],
  ],
  [
    'picklist option added',
    { Spec: picklist(['a', 'b']) },
    { Spec: picklist(['a', 'b', 'c']) },
    ['./sample#Spec|', 'additive'],
  ],
  [
    'picklist option removed',
    { Spec: picklist(['a', 'b']) },
    { Spec: picklist(['a']) },
    ['./sample#Spec|', 'breaking', 'map'],
  ],
  [
    'variant option inserted first',
    { Spec: Fight },
    { Spec: variant('kind', [Minion, Boss, Add]) },
    ['./sample#Spec|=minion', 'additive'],
  ],
  [
    'variant option removed',
    { Spec: Fight },
    { Spec: variant('kind', [Boss]) },
    ['./sample#Spec|=add', 'breaking', 'map'],
  ],
  [
    'kind literal renamed',
    shard({ kind: literal('tree') }),
    shard({ kind: literal('plant') }),
    ['./sample#Shard.kind', 'breaking', 'renameKind'],
  ],
  [
    'literal widened into a union',
    { Spec: literal('a') },
    { Spec: picklist(['a', 'b']) },
    ['./sample#Spec', 'review'],
  ],
  [
    'type changed',
    shard({ tag: string() }),
    shard({ tag: number() }),
    ['./sample#Shard.tag', 'breaking', 'map'],
  ],
  [
    'made optional',
    shard({ tag: string() }),
    shard({ tag: optional(string()) }),
    ['./sample#Shard.tag', 'additive'],
  ],
  [
    'made required',
    shard({ tag: exactOptional(string()) }),
    shard({ tag: string() }),
    ['./sample#Shard.tag', 'breaking', 'fill'],
  ],
  [
    'made nullable',
    shard({ tag: string() }),
    shard({ tag: nullable(string()) }),
    ['./sample#Shard.tag', 'additive'],
  ],
  [
    'new optional object counts once',
    shard({}),
    shard({ look: exactOptional(Look) }),
    ['./sample#Shard.look', 'additive'],
  ],
]

describe('format-diff classifies each seeded shape change', (): void => {
  for (const [title, before, after, expected] of SHAPES) {
    it(title, (): void => {
      assert.deepEqual(only(diffOf(before, after)), expected)
    })
  }
})

describe('format-diff ignores what is not a change', (): void => {
  it('a schema that becomes shared (a ref) with the same shape', (): void => {
    const before = {
      One: strictObject({ name: pipe(string(), maxLength(NAME_MAX)) }),
      Two: strictObject({ name: pipe(string(), maxLength(NAME_MAX)) }),
    }
    const after = {
      One: strictObject({ name: Name }),
      Two: strictObject({ name: Name }),
    }
    assert.deepEqual(diffOf(before, after).changes, [])
  })

  it('the worst kind across changes leads', (): void => {
    const report = diffOf(shard({ tag: string() }), shard({ label: Label }))
    assert.equal(report.worst, 'breaking')
  })
})
