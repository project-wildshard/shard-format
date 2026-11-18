import { expect, test } from 'vitest'

import { derivePrimitives } from './primitives.ts'
import { parseRows } from './rows.ts'

import type { ShardRows } from './rows.ts'

const horse = {
  id: 'fixture.horse',
  kind: 'horse',
  label: 'Horse',
  aggressive: false,
  lockable: true,
  dims: {
    bodyY: 1.4,
    bodyHalfLen: 1,
    bodyRadius: 0.4,
    headRadius: 0.25,
    legLen: 0.9,
    feet: [],
    halfWidth: 0.4,
  },
  variants: [
    {
      id: 'bay',
      label: 'Bay',
      rarity: 'common',
      weight: 1,
      scale: [1, 1],
      hp: 60,
      mods: {
        speed: 1,
        chargeDist: 1,
        damageTaken: 1,
        chargeDamage: 0,
        relentless: false,
      },
    },
  ],
  body: {
    skeleton: 'quadruped',
    size: 'large',
    scale: 1,
    look: 'fixture.horse.look',
  },
}
/** Nalati's ride gaits (`src/data/ecology.json` `modes.ride[0].gaits`). */
const gaits = { walk: 1.8, trot: 4.5, canter: 8.5, gallop: 13 }

function primitiveNames(species: unknown): string[] {
  return derivePrimitives(
    new Map([['actors/species', { rows: { species: [species] } }]]),
  ).map((row): string => row.name)
}

function rows(species: unknown): ShardRows {
  return parseRows({
    species: [species],
    weather: [],
    days: [],
    compendiums: [],
    loot: [],
    strikes: [],
    looks: [
      {
        id: 'fixture.horse.look',
        species: horse.id,
        recipe: 'platform.skin',
        // oxlint-disable-next-line unicorn/no-null -- Legacy material absence is explicitly null.
        material: null,
        parameters: {},
        animation: { recipe: 'platform.clips', parameters: {} },
      },
    ],
  })
}

test('CC40a: a mount row parses on any creature, its seat defaulting to the skeleton seat', (): void => {
  const [parsed] = rows({ ...horse, mount: { gaits } }).species
  expect(parsed?.mount).toEqual({ gaits })
  const [seated] = rows({ ...horse, mount: { seat: 'back', gaits } }).species
  expect(seated?.mount?.seat).toBe('back')
})

test('CC40a: a creature without a mount row parses byte-identical', (): void => {
  expect(JSON.stringify(rows(horse).species[0])).toBe(JSON.stringify(horse))
})

test('CC40a: gaits rise, stay bounded and name no extra key', (): void => {
  expect((): ShardRows =>
    rows({ ...horse, mount: { gaits: { ...gaits, trot: 20 } } }),
  ).toThrow('Mount gaits rise from walk to gallop')
  expect((): ShardRows =>
    rows({ ...horse, mount: { gaits: { walk: 1, gallop: 99 } } }),
  ).toThrow()
  expect((): ShardRows =>
    rows({ ...horse, mount: { gaits: { ...gaits, sprint: 14 } } }),
  ).toThrow()
  expect((): ShardRows =>
    rows({ ...horse, mount: { gaits, saddle: 'seat' } }),
  ).toThrow()
})

test('CC40a: an unknown seat, a body-less mount and a wingless flyer refuse by name', (): void => {
  expect((): ShardRows =>
    rows({ ...horse, mount: { seat: 'howdah', gaits } }),
  ).toThrow('Unknown mount seat howdah on fixture.horse')
  const { body: _body, ...bodiless } = horse
  expect((): ShardRows => rows({ ...bodiless, mount: { gaits } })).toThrow(
    'Mount fixture.horse needs a body',
  )
  expect((): ShardRows =>
    rows({ ...horse, mount: { gaits, fly: true } }),
  ).toThrow('Flying mount fixture.horse needs a flight row')
  const flight = { altitude: 30, climbRate: 4, diveRate: 6 }
  expect(
    rows({ ...horse, flight, mount: { gaits, fly: true } }).species[0]?.mount
      ?.fly,
  ).toBe(true)
})

test('CC40a: a species with a mount row switches the riding primitive on', (): void => {
  expect(primitiveNames(horse)).not.toContain('riding')
  expect(primitiveNames({ ...horse, mount: { gaits } })).toContain('riding')
})
