import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { CreatureAbilitySchema } from './creature-layers.ts'

const ability = { use: 'fixture.strike', range: 4, cooldown: 2, weight: 1 }
const parses = (row: object): boolean =>
  safeParse(CreatureAbilitySchema, { ...ability, ...row }).success

test('admits the gale wall impulse with lift and the stoop aim height', (): void => {
  for (const row of [
    { effect: 'impulse', strength: 14, lift: 2 },
    { effect: 'impulse', strength: 40 },
    { aimHeight: 1.2 },
    { effect: 'knockback', strength: 60, aimHeight: 10 },
  ]) {
    expect(parses(row)).toBe(true)
  }
})

test('refuses a lift without an impulse and out-of-range pushes', (): void => {
  for (const row of [
    { lift: 2 },
    { effect: 'knockback', strength: 6, lift: 2 },
    { effect: 'impulse' },
    { effect: 'impulse', strength: 41 },
    { effect: 'impulse', strength: 14, lift: 41 },
    { aimHeight: -1 },
    { aimHeight: 11 },
    { effect: 'pull', strength: 6 },
  ]) {
    expect(parses(row)).toBe(false)
  }
})
