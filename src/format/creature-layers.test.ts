import { expect, test } from 'vitest'

import { parseRows } from './rows.ts'

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
const layered: SpeciesRow = {
  ...legacy,
  type: 'beast',
  body: {
    skeleton: 'quadruped',
    size: 'medium',
    scale: 1.2,
    look: 'fixture.look',
  },
  temperament: {
    brain: 'pursue',
    reaction: 'aggressive',
    leash: 45,
    assist: 14,
    home: { speed: 3, stop: 0.5 },
    pack: true,
    territorial: 20,
    ambush: false,
    flee: 0.2,
  },
  senses: {
    notice: 18,
    sight: { range: 42, cone: 1.22, graze: 26 },
    hearing: { still: 4, crouch: 7, walk: 18, sprint: 34 },
    reveal: 3,
  },
  abilities: [
    {
      use: 'fixture.bite',
      range: [0, 2],
      cooldown: 1,
      weight: 1,
      hpBelow: 1,
      damage: 12,
      speed: 0,
      windup: 0.2,
      duration: 0.1,
    },
  ],
  presentation: {
    blood: false,
    sounds: {
      call: 'boar_grunt',
      hurt: 'boar_squeal',
      callVariants: ['fixture.call'],
      callEvery: [2, 4],
    },
  },
}

test('all layers parse while old species keep their exact JSON bytes', (): void => {
  expect(rows(layered).species).toEqual([layered])
  const after = rows(legacy)
  expect(JSON.stringify(after.species)).toBe(JSON.stringify([legacy]))
  for (const name of [
    'type',
    'body',
    'temperament',
    'senses',
    'abilities',
    'presentation',
  ]) {
    expect(Object.hasOwn(after.species[0] ?? {}, name)).toBe(false)
  }
})

test('unknown skeleton has a named refusal', (): void => {
  const changed = structuredClone(rows(layered))
  Object.assign(changed.species[0]?.body ?? {}, { skeleton: 'unknown' })
  expect((): ShardRows => parseRows(changed)).toThrow(
    'Unknown creature skeleton',
  )
})

test('unknown reaction has a named refusal', (): void => {
  const changed = structuredClone(rows(layered))
  Object.assign(changed.species[0]?.temperament ?? {}, { reaction: 'unknown' })
  expect((): ShardRows => parseRows(changed)).toThrow(
    'Unknown creature reaction',
  )
})

test('unknown sense has a named refusal', (): void => {
  const changed = structuredClone(rows(layered))
  Object.assign(changed.species[0]?.senses ?? {}, { smell: 20 })
  expect((): ShardRows => parseRows(changed)).toThrow('Unknown creature sense')
})

test('unknown ability has a named refusal', (): void => {
  const changed = structuredClone(rows(layered))
  Object.assign(changed.species[0]?.abilities?.[0] ?? {}, {
    use: 'fixture.unknown',
  })
  expect((): ShardRows => parseRows(changed)).toThrow(
    'Unknown creature ability: fixture.unknown',
  )
})

test('ability range is ordered', (): void => {
  const changed = structuredClone(rows(layered))
  Object.assign(changed.species[0]?.abilities?.[0] ?? {}, { range: [20, 8] })
  expect((): ShardRows => parseRows(changed)).toThrow(
    'Ordered creature ability range',
  )
})

test('ability health gate is a fraction', (): void => {
  const changed = structuredClone(rows(layered))
  Object.assign(changed.species[0]?.abilities?.[0] ?? {}, { hpBelow: 1.1 })
  expect((): ShardRows => parseRows(changed)).toThrow()
})

test('body scale is positive', (): void => {
  const changed = structuredClone(rows(layered))
  Object.assign(changed.species[0]?.body ?? {}, { scale: 0 })
  expect((): ShardRows => parseRows(changed)).toThrow()
})

test('body look must exist', (): void => {
  const changed = structuredClone(rows(layered))
  Object.assign(changed.species[0]?.body ?? {}, { look: 'fixture.missing' })
  expect((): ShardRows => parseRows(changed)).toThrow(
    'Unknown creature look: fixture.missing',
  )
})

test('pursuit keeps its own numeric parameters instead of requiring hunt fields', (): void => {
  const tuning = {
    awareRadius: 12,
    leashRadius: 25,
    speed: 1,
    returnSpeed: 2,
    stopDistance: 1.5,
    turnRate: 4,
    thinkDivisor: 3,
    attackCooldownTicks: 60,
    wanderRadius: 4,
    wanderEveryTicks: 420,
  }
  const species = {
    ...layered,
    temperament: {
      ...layered.temperament,
      brain: 'pursue',
      reaction: 'neutral',
      leash: 25,
      assist: 0,
      home: { speed: 2, stop: 1.5 },
      tuning,
    },
  }
  expect(rows(species).species[0]?.temperament?.tuning).toEqual(tuning)
})
