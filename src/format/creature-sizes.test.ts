import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import {
  CREATURE_SIZES,
  creatureScale,
  creatureSizeRules,
} from './creature-sizes.ts'
import { parseRows } from './rows.ts'
import { parseShardfile, shardfileRules } from './shardSchema.ts'

import type { CreatureBody } from './creature-layers.ts'
import type { ShardRows, SpeciesRow } from './rows.ts'

const VARIANT: SpeciesRow['variants'][number] = {
  id: 'plain',
  label: 'Plain',
  rarity: 'common',
  weight: 1,
  hp: 10,
  scale: [1, 1],
  mods: {
    speed: 1,
    chargeDist: 1,
    damageTaken: 1,
    chargeDamage: 1,
    relentless: false,
  },
}
const TEMPERAMENT: NonNullable<SpeciesRow['temperament']> = {
  brain: 'grazer',
  reaction: 'passive',
  leash: 20,
  assist: 0,
  home: { speed: 1, stop: 1 },
  tuning: {
    moveSpeed: 1,
    fleeSpeed: 2,
    noticeRadius: 5,
    forgetRadius: 10,
    boltRadius: 3,
    stopDistance: 1,
    wanderRadius: 4,
    wanderEveryTicks: 420,
  },
}
function fixture(): { species: SpeciesRow; look: unknown } {
  return {
    species: {
      id: 'fixture.giant',
      kind: 'fixture',
      label: 'Fixture',
      aggressive: false,
      lockable: true,
      dims: {
        bodyY: 1.75,
        bodyRadius: 0.3,
        headRadius: 0.25,
        bodyHalfLen: 0.5,
        legLen: 0.5,
        halfWidth: 0.3,
        feet: [],
      },
      variants: [structuredClone(VARIANT)],
      body: { size: 'giant', scale: 1, look: 'fixture.look' },
      temperament: structuredClone(TEMPERAMENT),
    },
    look: {
      id: 'fixture.look',
      species: 'fixture.giant',
      recipe: 'engine.sphere',
      animation: { recipe: 'engine.none', parameters: {} },
      parameters: {},
    },
  }
}
function declaredRows(species: unknown, look: unknown): ShardRows {
  return parseRows({
    species: [species],
    looks: [look],
    strikes: [],
    weather: [],
    days: [],
    compendiums: [],
    loot: [],
  })
}
test.each(['tiny', 'small', 'medium', 'large', 'giant'] as const)(
  '%s defines one complete size policy and preserves free scale',
  (size): void => {
    const body: CreatureBody = { size, scale: 1, look: 'fixture.look' },
      policy = CREATURE_SIZES[size]
    expect(creatureScale(body)).toBe(policy.scale)
    expect(creatureScale({ ...body, scale: 1.2 }, 2)).toBe(
      policy.scale * 1.2 * 2,
    )
    expect(policy.stride).toBeGreaterThan(0)
    expect(policy.aggro).toBeGreaterThan(0)
    expect(policy.cellWeight).toBeGreaterThan(0)
  },
)
test('medium and omitted body layers retain identity and complete old row bytes', (): void => {
  const data = fixture()
  delete data.species.body
  const rows = declaredRows(data.species, data.look)
  const before = JSON.stringify(rows)
  expect(JSON.stringify(parseRows(rows))).toBe(before)
  expect(creatureScale(undefined, 1.2)).toBe(1.2)
  expect(CREATURE_SIZES.medium).toMatchObject({
    scale: 1,
    stride: 1,
    aggro: 1,
    cellWeight: 1,
  })
})
test('defining row admission accepts exactly15m', (): void => {
  const data = fixture()
  expect(creatureSizeRules([data.species])).toEqual([])
  expect(declaredRows(data.species, data.look).species[0]?.body?.size).toBe(
    'giant',
  )
})
test.each(['body', 'variant'] as const)(
  'row admission refuses oversized %s scale',
  (kind): void => {
    const data = fixture()
    const { body, variants } = data.species
    const [variant] = variants
    if (body === undefined || variant === undefined) {
      throw new Error('Missing size fixture')
    }
    if (kind === 'body') {
      body.scale = 1.000001
    } else {
      variant.scale = [1, 1.2]
    }
    expect((): ShardRows => declaredRows(data.species, data.look)).toThrow(
      'giant exceeds 15 m',
    )
  },
)
test('the ordinary complete shard parser includes explicit spawn scale in the giant cap', (): void => {
  const data = fixture(),
    source = outputFixture()
  source.rows = declaredRows(data.species, data.look)
  source.creatures = {
    brains: [],
    groups: [],
    spawns: [
      {
        id: 'fixture.actor',
        species: data.species.id,
        variant: 'plain',
        // oxlint-disable-next-line unicorn/no-null -- The inline temperament owns this actor.
        brain: null,
        // oxlint-disable-next-line unicorn/no-null -- No separately named strike.
        strike: null,
        at: [0, 0, 0],
        yaw: 0,
        scale: 1,
        seed: 1,
      },
    ],
  }
  expect((): ReturnType<typeof parseShardfile> =>
    parseShardfile(source),
  ).not.toThrow()
  const [actor] = source.creatures.spawns
  if (actor === undefined) {
    throw new Error('Missing size spawn')
  }
  actor.scale = 1.2
  expect(shardfileRules(source)).toContain(
    'spawn fixture.actor: giant exceeds 15 m',
  )
  expect((): ReturnType<typeof parseShardfile> =>
    parseShardfile(source),
  ).toThrow('shardfile semantic rules')
})
