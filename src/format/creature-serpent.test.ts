// ONE-FORMAT CC23: the serpent contract and its trail row.
import { expect, test } from 'vitest'

import {
  CREATURE_SKELETONS,
  creatureContract,
  serpentContract,
  skeletonBones,
  trailBoneNames,
} from './creature-skeletons.ts'
import { parseRows } from './rows.ts'

import type { SkeletonContract, SkeletonVolume } from './creature-skeletons.ts'
import type { ShardRows, SpeciesRow } from './rows.ts'

const legacy: SpeciesRow = {
  id: 'fixture.creature',
  kind: 'fixture',
  label: 'Fixture',
  aggressive: false,
  lockable: true,
  dims: {
    bodyY: 1,
    bodyHalfLen: 0.5,
    bodyRadius: 0.3,
    headRadius: 0.3,
    legLen: 0.5,
    feet: [],
    halfWidth: 0.4,
  },
  variants: [
    {
      id: 'plain',
      label: 'Plain',
      rarity: 'common',
      weight: 1,
      scale: [1, 1],
      hp: 25,
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
    strikes: [
      {
        id: 'fixture.bite',
        shape: { kind: 'sphere', radius: 0.5 },
        windup: 0.2,
        active: 0.1,
        recover: 0.3,
        cooldown: 1,
        range: 2,
        damage: 12,
        tags: ['creature.bite'],
        weight: 1,
        speed: 0,
      },
    ],
    looks: [
      {
        id: 'fixture.look',
        species: legacy.id,
        recipe: 'platform.skin',
        // oxlint-disable-next-line unicorn/no-null -- Legacy material absence is explicitly null.
        material: null,
        parameters: {},
        animation: { recipe: 'platform.clips', parameters: {} },
      },
    ],
  })
}
const serpent = {
  skeleton: 'serpent',
  trail: { count: 14, spacing: 1.6 },
  size: 'giant',
  scale: 1,
  look: 'fixture.look',
}
const wyrm = serpentContract({ count: 14, spacing: 1.6 })

test('a serpent contract is its trail, head first', (): void => {
  expect(skeletonBones(wyrm)).toEqual(trailBoneNames(14))
  expect(trailBoneNames(4)).toEqual(['head', 'seg1', 'seg2', 'tail'])
  expect(wyrm.chains['spine']?.parent).toBe('head')
  expect(wyrm.lock).toBe('head')
})

test('a serpent has head, mouth, core and tail sockets', (): void => {
  expect(wyrm.sockets['core']?.bone).toBe('seg7')
  expect(wyrm.sockets['tail']?.bone).toBe('tail')
  expect(wyrm.sockets['mouth']?.bone).toBe('head')
})

test('a serpent has the head ball and a capsule a segment', (): void => {
  const [head, ...segments] = wyrm.volumes
  expect(head?.part).toBe('head')
  expect(segments.map((volume: SkeletonVolume): string => volume.bone)).toEqual(
    trailBoneNames(14).slice(1),
  )
  for (const volume of segments) {
    expect(volume).toMatchObject({
      shape: 'capsule',
      halfLength: 0.8,
      multiplier: 0.5,
    })
  }
})

test('creatureContract builds a serpent and passes the fixed skeletons through', (): void => {
  expect(
    creatureContract({ skeleton: 'serpent', trail: serpent.trail }),
  ).toEqual(wyrm)
  expect(creatureContract({ skeleton: 'biped' })).toBe(CREATURE_SKELETONS.biped)
  expect((): SkeletonContract =>
    creatureContract({ skeleton: 'serpent' }),
  ).toThrow('trail row')
})

test('a serpent body declares its trail', (): void => {
  expect(rows({ ...legacy, body: serpent }).species[0]?.body).toEqual(serpent)
  const { trail: _trail, ...bare } = serpent
  expect((): ShardRows => rows({ ...legacy, body: bare })).toThrow(
    'A serpent has a trail row and only a serpent has one',
  )
})

test('only a serpent declares a trail', (): void => {
  const quadruped = { ...serpent, skeleton: 'quadruped' }
  expect((): ShardRows => rows({ ...legacy, body: quadruped })).toThrow(
    'A serpent has a trail row',
  )
})

test.each([
  { count: 2, spacing: 1 },
  { count: 17, spacing: 1 },
  { count: 4.5, spacing: 1 },
  { count: 4, spacing: 0 },
  { count: 4, spacing: 11 },
])('a trail of %o refuses', (trail: object): void => {
  expect((): ShardRows =>
    rows({ ...legacy, body: { ...serpent, trail } }),
  ).toThrow()
})

test('16 trail bones fill the volume cap', (): void => {
  const longest = { ...serpent, trail: { count: 16, spacing: 1 } }
  expect(
    rows({ ...legacy, body: longest }).species[0]?.body?.trail?.count,
  ).toBe(16)
})
