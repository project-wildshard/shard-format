import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { CreatureAbilitySchema } from './creature-layers.ts'

import type { CreatureAbility } from './creature-layers.ts'

test('admits a creature strike with numeric projectile flight', (): void => {
  const ability = { use: 'fixture.fireball', range: 20, cooldown: 2, weight: 1 }
  const projectile = { speed: 20, gravity: 0, radius: 0.25 }
  expect(parse(CreatureAbilitySchema, { ...ability, projectile })).toEqual({
    ...ability,
    projectile,
  })
  expect(parse(CreatureAbilitySchema, ability)).toEqual(ability)
  for (const input of [
    { ...projectile, speed: 0 },
    { ...projectile, speed: Infinity },
    { ...projectile, gravity: -1 },
    { ...projectile, radius: 0 },
    { ...projectile, entity: 'actor.fireball' },
  ]) {
    expect((): CreatureAbility =>
      parse(CreatureAbilitySchema, { ...ability, projectile: input }),
    ).toThrow()
  }
})
