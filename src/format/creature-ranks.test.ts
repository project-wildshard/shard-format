import { parse } from 'valibot'
import { expect, test } from 'vitest'

import {
  CREATURE_RANK_NAMES,
  CREATURE_RANKS,
  creatureRank,
} from './creature-ranks.ts'
import { creatureSizeRules } from './creature-sizes.ts'
import { CreaturesSchema } from './creatures.ts'

/** A plain spawn row, read from JSON as an author's file would be (its brain and strike are JSON nulls). */
const SPAWN_JSON =
  '{"id":"wolf.1","species":"kit.wolf","variant":"grey","brain":null,"strike":null,"seed":1,"scale":1,"at":[0,0,0],"yaw":0'
function spawn(rank?: string): unknown {
  return JSON.parse(
    rank === undefined ? `${SPAWN_JSON}}` : `${SPAWN_JSON},"rank":"${rank}"}`,
  )
}
/** Exactly at the giant cap at scale 1: 3.75 m model height x giant scale 4 = 15 m. */
const GIANT = {
  id: 'fixture.giant',
  body: { size: 'giant', scale: 1, look: 'fixture.look' },
  dims: { bodyY: 1.75, bodyRadius: 0.3, headRadius: 0.25 },
  variants: [{ scale: [1, 1] }],
} as const

test('OF28: a spawn row takes a rank; a row without one parses byte-identical', (): void => {
  const plain = { brains: [], groups: [], spawns: [spawn()] }
  expect(JSON.stringify(parse(CreaturesSchema, plain))).toBe(
    JSON.stringify(plain),
  )
  for (const rank of CREATURE_RANK_NAMES) {
    const ranked = parse(CreaturesSchema, {
      brains: [],
      spawns: [spawn(rank)],
    })
    expect(ranked.spawns[0]?.rank).toBe(rank)
  }
})

test('OF28: an unknown rank refuses with a named error', (): void => {
  expect((): unknown =>
    parse(CreaturesSchema, {
      brains: [],
      spawns: [spawn('boss')],
    }),
  ).toThrow('unknown creature rank')
})

test('OF28: each rank is stronger than the one before on hp, damage, size and loot', (): void => {
  const policies = [
    creatureRank(),
    ...CREATURE_RANK_NAMES.map(
      (name): (typeof CREATURE_RANKS)[keyof typeof CREATURE_RANKS] =>
        CREATURE_RANKS[name],
    ),
  ]
  for (const [index, policy] of policies.entries()) {
    const before = policies[index - 1]
    if (before !== undefined) {
      expect(policy.hp).toBeGreaterThan(before.hp)
      expect(policy.damage).toBeGreaterThan(before.damage)
      expect(policy.size).toBeGreaterThan(before.size)
      expect(policy.loot).toBeGreaterThan(before.loot)
    }
  }
  expect(creatureRank()).toEqual({
    hp: 1,
    damage: 1,
    size: 1,
    loot: 1,
  })
})

test('OF28: a rank grows the body, so a ranked giant still keeps under the 15 m cap', (): void => {
  const at = { id: 'giant.1', species: GIANT.id, scale: 1 }
  expect(creatureSizeRules([GIANT], [at])).toEqual([])
  expect(creatureSizeRules([GIANT], [{ ...at, rank: 'veteran' }])).toEqual([
    'spawn giant.1: giant exceeds 15 m',
  ])
  expect(
    creatureSizeRules([GIANT], [{ ...at, scale: 0.9, rank: 'veteran' }]),
  ).toEqual([])
})
