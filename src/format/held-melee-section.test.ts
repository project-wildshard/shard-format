import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { HeldMeleeSchema } from './items.ts'
import { PLATFORM_DATA_SECTIONS } from './platformDataSections.ts'
import { ACCEPTED_SECTION_VERSIONS } from './section-versions.ts'

// ONE-FORMAT OF22d1 (meta): Driftwood's swept sword kit is a declared `held/melee` row, not a server policy file its
// native plan's `item.swept` host reads (Q-S8, J367 (4): melee is one of the two held primitives).
const moves = {
  combo: ['move.slash', 'move.backhand', 'move.finisher'],
  heavy: 'move.heavy',
}
const driftwood = {
  kind: 'swept',
  step: 'item.driftwood-isle.swords',
  eye: 1.68,
  initial: 0,
  source: 'env',
  selection: { initial: 0, lower: 0, raise: 0, slots: [0, 1] },
  slots: [
    {
      item: 'weapon.driftwood-isle.wood',
      weapon: 'weapon.sword',
      tags: ['actor.player', 'weapon.sword', 'dmg.melee', 'cover.checked'],
      ...moves,
    },
    {
      item: 'weapon.driftwood-isle.iron',
      weapon: 'weapon.sword-iron',
      tags: ['actor.player', 'weapon.sword-iron', 'dmg.melee', 'cover.checked'],
      ...moves,
    },
  ],
  contact: {
    slack: 0.3,
    direction: [0.7, 0.7, 0.35],
    push: [0.8, 0.5],
    running: 1.5,
  },
  lunge: { maxHeight: 2, minDistance: 0.01, minRadius: 0.3, lengthScale: 0.6 },
}

test('held/melee is a platform section that admits a swept sword kit', (): void => {
  expect(PLATFORM_DATA_SECTIONS['held/melee'].schema).toBe(HeldMeleeSchema)
  expect(ACCEPTED_SECTION_VERSIONS['held/melee']).toEqual([1])
  expect(parse(HeldMeleeSchema, driftwood)).toEqual(driftwood)
  expect(
    safeParse(HeldMeleeSchema, { ...driftwood, slots: [] }).success,
    'a kit holds at least one slot',
  ).toBe(false)
  expect(
    safeParse(HeldMeleeSchema, { ...driftwood, kind: 'thrown' }).success,
  ).toBe(false)
})
