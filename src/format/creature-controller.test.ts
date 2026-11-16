import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { CreaturesSchema } from './creatures.ts'
import { EncountersSchema } from './encounters.ts'
import { parseRows } from './rows.ts'
import { parseShardfile, shardfileRules } from './shardSchema.ts'

import type { CreatureTemperament } from './creature-layers.ts'
import type { ShardCreatures } from './creatures.ts'
import type { SpeciesRow } from './rows.ts'
import type { Shardfile } from './shardSchema.ts'

const rows = parseRows({
  species: [
    {
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
      temperament: {
        brain: 'hunt',
        reaction: 'neutral',
        leash: 25,
        assist: 0,
        home: { speed: 2, stop: 1 },
      },
    },
  ],
  looks: [
    {
      id: 'fixture.look',
      species: 'fixture.creature',
      recipe: 'engine.sphere',
      parameters: {},
      animation: { recipe: 'engine.scale-wave', parameters: {} },
    },
  ],
  strikes: [],
  weather: [],
  days: [],
  compendiums: [],
  loot: [],
})

function fixture(brain = 'hunt'): {
  source: Shardfile
  species: SpeciesRow
  spawn: ShardCreatures['spawns'][number]
  temperament: CreatureTemperament
} {
  const source = outputFixture()

  source.rows = structuredClone(rows)
  source.creatures = parse(CreaturesSchema, {
    brains: [],
    groups: [],
    spawns: [
      {
        id: 'fixture.actor',
        species: 'fixture.creature',
        variant: 'plain',
        // oxlint-disable-next-line unicorn/no-null -- The temperament owns this spawn instead of a named brain.
        brain: null,
        // oxlint-disable-next-line unicorn/no-null -- This actor has no separately installed strike.
        strike: null,
        at: [0, 0, 0],
        yaw: 0,
        scale: 1,
        seed: 1,
      },
    ],
  })
  const [species] = source.rows.species,
    [spawn] = source.creatures.spawns
  if (species?.temperament === undefined || spawn === undefined) {
    throw new Error('Missing fixture owner')
  }
  species.temperament.brain = brain
  return { source, species, spawn, temperament: species.temperament }
}

test.each(['hunt', 'pursue'])(
  'the %s temperament owns a null-brain spawn through real admission',
  (brain): void => {
    const { source } = fixture(brain)
    expect(shardfileRules(source)).toEqual([])
    expect(parseShardfile(source).creatures.spawns).toEqual(
      source.creatures.spawns,
    )
  },
)

test('missing controllers refuse while previously admitted named owners remain readable', (): void => {
  const { source, species } = fixture('none')
  expect(shardfileRules(source)).toContain(
    'exactly one declared creature controller',
  )
  delete species.temperament
  expect(shardfileRules(source)).toContain(
    'exactly one declared creature controller',
  )
})

test('previously admitted named owners remain readable with a temperament', (): void => {
  const { source, species, spawn } = fixture('hunt')
  species.temperament = {
    brain: 'fixture.named',
    reaction: 'neutral',
    leash: 25,
    assist: 0,
    home: { speed: 2, stop: 1 },
  }
  source.creatures.brains = [
    {
      id: 'fixture.named',
      kind: 'pursue',
      awareRadius: 20,
      leashRadius: 45,
      speed: 1.7,
      returnSpeed: 2,
      stopDistance: 1,
      turnRate: 3,
      thinkDivisor: 3,
      attackCooldownTicks: 90,
      wanderRadius: 2,
      wanderEveryTicks: 300,
    },
  ]
  spawn.brain = 'fixture.named'
  expect(shardfileRules(source)).toEqual([])
  species.temperament.brain = 'hunt'
  expect(shardfileRules(source)).toEqual([])
  expect(parseShardfile(source).creatures.spawns).toEqual(
    source.creatures.spawns,
  )
})

function encounterFixture(): ReturnType<typeof fixture> {
  const value = fixture('hunt')
  const { source, spawn } = value
  source.encounters = parse(EncountersSchema, [
    {
      id: 'fixture.encounter',
      entity: spawn.id,
      kind: 'elite',
      // oxlint-disable-next-line unicorn/no-null -- This encounter has no boss panel.
      panel: null,
      name: 'Fixture',
      title: 'Fixture',
      retry: 'Retry',
      arena: { at: [0, 0, 0], radius: 10 },
      intro: 0,
      introShort: 0,
      respawn: { at: [1, 0, 1], yaw: 0 },
      phases: [
        {
          at: 1,
          name: 'Phase',
          caption: 'Phase',
          speed: 0,
          stopDistance: 1,
          turnRate: 1,
        },
      ],
    },
  ])
  return value
}

test('previously admitted encounters remain readable with a temperament', (): void => {
  const { source } = encounterFixture()
  expect(shardfileRules(source)).toEqual([])
  expect(parseShardfile(source).creatures.spawns).toEqual(
    source.creatures.spawns,
  )
})

test('an encounter still refuses a competing explicit spawn controller', (): void => {
  const { source, spawn } = encounterFixture()
  spawn.brain = 'fixture.missing'
  expect(shardfileRules(source)).toContain(
    'exactly one declared creature controller',
  )
})

test.each(['none', 'hnut', 'fixture.missing', 'constructor'])(
  'a null-brain spawn refuses unknown policy %s',
  (brain): void => {
    const { source } = fixture(brain)
    expect(shardfileRules(source)).toContain(
      'exactly one declared creature controller',
    )
    expect((): Shardfile => parseShardfile(source)).toThrow(
      'shardfile semantic rules',
    )
  },
)

test('a temperament cannot pretend that a group owns a null-brain spawn', (): void => {
  const { source } = fixture('fixture.herd')
  source.creatures.groups = [
    {
      id: 'fixture.herd',
      kind: 'herd',
      members: ['fixture.actor'],
      thinkDivisor: 6,
      walkSpeed: 1,
      trotSpeed: 3,
      gallopSpeed: 7,
      chargeSpeed: 6,
      sightRadius: 30,
      grazingSightRadius: 12,
      coneAngle: 1,
      hearing: [1, 2, 4, 8],
      alertThreshold: 0.4,
      flightMinDistance: 20,
      flightMaxDistance: 35,
      stallionVariant: 'buck',
      foalPrefix: 'kid',
      snortCue: 'bleat',
      neighCue: 'bleat',
      squealCue: 'bleat',
    },
  ]
  expect(shardfileRules(source)).toContain(
    'exactly one declared creature controller',
  )
})
