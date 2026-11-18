import { expect, test } from 'vitest'

import { actorMoveRules, parseActorMoves } from './actorMoves.ts'

const none: ReadonlySet<string> = new Set()
const refs = { spots: new Set(['mound']), strikes: none, fields: none }

test('CC17: a leap row parses to the target or a spot, with gravity defaulting to 9.81', (): void => {
  const rows = parseActorMoves([
    { id: 'pounce', kind: 'leap', to: { kind: 'target' }, height: 9 },
    {
      id: 'hop',
      kind: 'leap',
      to: { kind: 'spot', spot: 'mound' },
      height: 2,
      gravity: 20,
    },
  ])
  expect(rows).toEqual([
    {
      id: 'pounce',
      kind: 'leap',
      to: { kind: 'target' },
      height: 9,
      gravity: 9.81,
    },
    {
      id: 'hop',
      kind: 'leap',
      to: { kind: 'spot', spot: 'mound' },
      height: 2,
      gravity: 20,
    },
  ])
  expect(actorMoveRules(rows, refs)).toEqual([])
})

test('CC17: a leap refuses a missing or out-of-range height or gravity, an unknown point and an unresolved spot', (): void => {
  for (const bad of [
    { id: 'a', kind: 'leap', to: { kind: 'target' } },
    { id: 'a', kind: 'leap', to: { kind: 'target' }, height: 0 },
    { id: 'a', kind: 'leap', to: { kind: 'target' }, height: 101 },
    { id: 'a', kind: 'leap', to: { kind: 'target' }, height: 9, gravity: 0 },
    { id: 'a', kind: 'leap', to: { kind: 'player' }, height: 9 },
    { id: 'a', kind: 'leap', to: { kind: 'target' }, height: 9, speed: 3 },
  ]) {
    expect((): unknown => parseActorMoves([bad])).toThrow()
  }
  const rows = parseActorMoves([
    {
      id: 'hop',
      kind: 'leap',
      to: { kind: 'spot', spot: 'nowhere' },
      height: 2,
    },
  ])
  expect(actorMoveRules(rows, refs)).toEqual([
    'move location resolves in world spots',
  ])
})
