// ONE-FORMAT CC58a: the horizontal biped (Q-CC38): a biped whose spine pitches forward and whose tail is trail bones.
import { expect, test } from 'vitest'

import {
  CREATURE_SKELETONS,
  HORIZONTAL_SPINE_PITCH,
  creatureContract,
  horizontalBipedContract,
  serpentContract,
  skeletonBones,
  tailBoneNames,
  trailBoneNames,
} from './creature-skeletons.ts'
import { parseRows } from './rows.ts'

import type { SkeletonVolume } from './creature-skeletons.ts'
import type { ShardRows, SpeciesRow } from './rows.ts'

const legacy: SpeciesRow = {
  id: 'fixture.rex',
  kind: 'rex',
  label: 'Rex',
  aggressive: true,
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
    strikes: [],
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
const rex = {
  skeleton: 'biped',
  stance: 'horizontal',
  trail: { count: 6, spacing: 0.8 },
  size: 'large',
  scale: 1,
  look: 'fixture.look',
}
const contract = horizontalBipedContract({ count: 6, spacing: 0.8 })

test('a horizontal biped is the biped plus a tail of trail bones off the hips', (): void => {
  expect(tailBoneNames(3)).toEqual(['tail1', 'tail2', 'tail3'])
  expect(contract.chains['tail']).toEqual({
    parent: 'hips',
    bones: tailBoneNames(6),
  })
  expect(contract.trail).toEqual(tailBoneNames(6))
  expect(skeletonBones(contract)).toEqual([
    ...skeletonBones(CREATURE_SKELETONS.biped),
    ...tailBoneNames(6),
  ])
  for (const [name, chain] of Object.entries(CREATURE_SKELETONS.biped.chains)) {
    expect(contract.chains[name]).toEqual(chain)
  }
})

test('its spine pitches forward and its tail tip is a socket', (): void => {
  expect(contract.pitch).toEqual({
    bone: 'spine',
    angle: HORIZONTAL_SPINE_PITCH,
  })
  expect(HORIZONTAL_SPINE_PITCH).toBeGreaterThan(1)
  expect(HORIZONTAL_SPINE_PITCH).toBeLessThan(Math.PI / 2)
  expect(contract.sockets['tail']?.bone).toBe('tail6')
  expect(contract.sockets['mouth']).toEqual(
    CREATURE_SKELETONS.biped.sockets['mouth'],
  )
  expect(contract.lock).toBe('chest')
})

test('its tail has a capsule a bone at half damage', (): void => {
  const tail = contract.volumes.filter((volume: SkeletonVolume): boolean =>
    volume.bone.startsWith('tail'),
  )
  expect(tail.map((volume: SkeletonVolume): string => volume.part)).toEqual(
    tailBoneNames(6),
  )
  for (const volume of tail) {
    expect(volume).toMatchObject({
      shape: 'capsule',
      halfLength: 0.4,
      multiplier: 0.5,
      axis: 'z',
    })
  }
  expect(contract.volumes.slice(0, 2)).toEqual(CREATURE_SKELETONS.biped.volumes)
})

test('creatureContract picks the stance', (): void => {
  expect(
    creatureContract({
      skeleton: 'biped',
      stance: 'horizontal',
      trail: rex.trail,
    }),
  ).toEqual(contract)
  expect(creatureContract({ skeleton: 'biped', stance: 'upright' })).toBe(
    CREATURE_SKELETONS.biped,
  )
  expect((): unknown =>
    creatureContract({ skeleton: 'biped', stance: 'horizontal' }),
  ).toThrow('tail trail row')
  // The serpent names its trail bones too, head first
  expect(serpentContract({ count: 4, spacing: 1 }).trail).toEqual(
    trailBoneNames(4),
  )
  expect(CREATURE_SKELETONS.biped.trail).toBeUndefined()
})

test('a horizontal biped body declares its stance and tail', (): void => {
  expect(rows({ ...legacy, body: rex }).species[0]?.body).toEqual(rex)
  const upright = { ...rex, stance: 'upright' }
  const { trail: _trail, ...plain } = upright
  expect(rows({ ...legacy, body: plain }).species[0]?.body).toEqual(plain)
})

test('a horizontal biped without a tail refuses', (): void => {
  const { trail: _trail, ...bare } = rex
  expect((): ShardRows => rows({ ...legacy, body: bare })).toThrow(
    'A horizontal biped has a tail trail row',
  )
})

test('an upright biped with a trail still refuses', (): void => {
  expect((): ShardRows =>
    rows({ ...legacy, body: { ...rex, stance: 'upright' } }),
  ).toThrow('A serpent has a trail row')
})

test.each(['quadruped', 'serpent'])(
  'only a biped has a stance, not a %s',
  (skeleton: string): void => {
    expect((): ShardRows =>
      rows({ ...legacy, body: { ...rex, skeleton } }),
    ).toThrow('Only a biped has a stance')
  },
)

test('an unknown stance refuses', (): void => {
  expect((): ShardRows =>
    rows({ ...legacy, body: { ...rex, stance: 'crouched' } }),
  ).toThrow('Unknown biped stance')
})

test('a tail past the volume cap refuses', (): void => {
  const long = { ...rex, trail: { count: 15, spacing: 0.5 } }
  expect((): ShardRows => rows({ ...legacy, body: long })).toThrow(
    'Too many resolved creature volumes',
  )
  const most = { ...rex, trail: { count: 14, spacing: 0.5 } }
  expect(rows({ ...legacy, body: most }).species[0]?.body?.trail?.count).toBe(
    14,
  )
})
