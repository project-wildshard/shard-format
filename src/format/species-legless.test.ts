import { expect, test } from 'vitest'

import { parseRows } from './rows.ts'

import type { ShardRows } from './rows.ts'

// ONE-FORMAT OF11a: a flyer's physics bake has no legs (Dunes' ray and Matriarch: `legLen` 0). Its plain species row
// keeps that number; every other body dimension stays positive.
const ray = {
  id: 'fixture.ray',
  kind: 'ray',
  label: 'Ray',
  aggressive: true,
  lockable: true,
  dims: {
    bodyY: 0.3,
    bodyHalfLen: 1.1,
    bodyRadius: 0.8,
    headRadius: 0.4,
    legLen: 0,
    feet: [],
    halfWidth: 2.6,
  },
  flight: { altitude: 14, above: 'ground', climbRate: 6, diveRate: 24 },
  variants: [
    {
      id: 'dusk',
      label: 'Ray',
      rarity: 'common',
      weight: 1,
      scale: [1, 1.15],
      hp: 70,
      mods: {
        speed: 1,
        chargeDist: 1,
        damageTaken: 1,
        chargeDamage: 25,
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

test('OF11a: a legless flyer is a plain species row', (): void => {
  expect(rows(ray).species[0]?.dims.legLen).toBe(0)
})

test('OF11a: legs stay nonnegative and the body stays positive', (): void => {
  expect((): ShardRows =>
    rows({ ...ray, dims: { ...ray.dims, legLen: -0.1 } }),
  ).toThrow()
  expect((): ShardRows =>
    rows({ ...ray, dims: { ...ray.dims, bodyRadius: 0 } }),
  ).toThrow()
})
