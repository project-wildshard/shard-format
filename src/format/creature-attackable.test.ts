import { expect, test } from 'vitest'

import { attackableBy } from './creature-attackable.ts'
import { parseRows } from './rows.ts'

import type { ShardRows } from './rows.ts'

const blob = {
  id: 'fixture.blob',
  kind: 'blob',
  label: 'Blob',
  aggressive: false,
  lockable: true,
  dims: {
    bodyY: 0.4,
    bodyHalfLen: 0.4,
    bodyRadius: 0.4,
    headRadius: 0.2,
    legLen: 0.1,
    feet: [],
    halfWidth: 0.4,
  },
  variants: [
    {
      id: 'grey',
      label: 'Grey',
      rarity: 'common',
      weight: 1,
      scale: [1, 1],
      hp: 10,
      mods: {
        speed: 1,
        chargeDist: 1,
        damageTaken: 1,
        chargeDamage: 0,
        relentless: false,
      },
    },
  ],
}

function rows(species: unknown): ShardRows {
  return parseRows({
    species: [species],
    weather: [],
    days: [],
    compendiums: [],
    loot: [],
    strikes: [],
    looks: [],
  })
}

test('OF38a: each attackable form parses on a species row', (): void => {
  expect(rows({ ...blob, attackable: false }).species[0]?.attackable).toBe(
    false,
  )
  expect(
    rows({ ...blob, attackable: { by: ['ranged'] } }).species[0]?.attackable,
  ).toEqual({ by: ['ranged'] })
  // Nalati's two aim exclusions, moved onto the creature (OF38c).
  const unless = [
    { field: 'hidden', equals: 1 },
    { field: 'owned', equals: 1 },
  ]
  expect(
    rows({ ...blob, attackable: { unless } }).species[0]?.attackable,
  ).toEqual({ unless })
})

test('OF38a: a species without the declaration parses byte-identical', (): void => {
  expect(JSON.stringify(rows(blob).species[0])).toBe(JSON.stringify(blob))
})

test('OF38a: an unknown weapon class, field or form refuses by name', (): void => {
  expect((): ShardRows =>
    rows({ ...blob, attackable: { by: ['magic'] } }),
  ).toThrow('Unknown attackable weapon class')
  expect((): ShardRows =>
    rows({ ...blob, attackable: { by: ['melee', 'melee'] } }),
  ).toThrow('Attackable by repeats a weapon class')
  expect((): ShardRows => rows({ ...blob, attackable: { by: [] } })).toThrow(
    'Attackable by needs a weapon class',
  )
  expect((): ShardRows =>
    rows({ ...blob, attackable: { only: ['melee'] } }),
  ).toThrow('Unknown attackable field')
  expect((): ShardRows =>
    rows({
      ...blob,
      attackable: { unless: [{ field: 'Hidden!', equals: 1 }] },
    }),
  ).toThrow('Unknown attackable field')
  expect((): ShardRows => rows({ ...blob, attackable: true })).toThrow(
    'Attackable true is the default; omit it',
  )
})

test('OF38a: attackableBy reads the declaration, the weapon class and the memory', (): void => {
  expect(attackableBy(undefined, 'melee')).toBe(true)
  expect(attackableBy(false, 'ranged')).toBe(false)
  expect(attackableBy({ by: ['ranged'] }, 'melee')).toBe(false)
  expect(attackableBy({ by: ['ranged'] }, 'ranged')).toBe(true)
  const shielded = { unless: [{ field: 'hidden', equals: 1 }] }
  expect(attackableBy(shielded, 'melee', { hidden: 1 })).toBe(false)
  expect(attackableBy(shielded, 'melee', { hidden: 0 })).toBe(true)
  expect(attackableBy(shielded, 'melee')).toBe(true)
})
