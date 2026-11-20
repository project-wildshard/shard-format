// ONE-FORMAT OF22c2: a declared boss keeps its decision row's public fields. A runtime that binds `state` admits public
// numeric shared fields only as a retained actor's (a decision row's `Read.field` / `Do.field` memory): until now that
// actor was the runtime's boss spawn. Driftwood's Drowned Captain moves to a declared spawn under a `boss` encounter, and
// his decision row keeps its fields (rise, phase, arena, ...), so a declared encounter's spawn is that retained actor too.
import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { CreaturesSchema } from './creatures.ts'
import { EncountersSchema } from './encounters.ts'
import { retainedActorIds } from './retained-actors.ts'
import { parseRows } from './rows.ts'
import { RuntimeSchema } from './runtime.ts'
import { shardfileRules } from './shardSchema.ts'

import type { Shardfile } from './shardSchema.ts'

const variant = {
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
}
const dims = {
  bodyY: 1,
  bodyHalfLen: 0.5,
  bodyRadius: 0.3,
  headRadius: 0.3,
  legLen: 0.5,
  feet: [],
  halfWidth: 0.4,
}
const rows = parseRows({
  species: [
    {
      id: 'fixture.creature',
      kind: 'fixture',
      label: 'Fixture',
      aggressive: true,
      lockable: true,
      dims,
      variants: [variant],
      temperament: {
        brain: 'none',
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
const RULE =
  'runtime-bound state supports host fields and retained-actor numeric fields'

const spawn = {
  id: 'fixture.boss',
  species: 'fixture.creature',
  variant: 'plain',
  // oxlint-disable-next-line unicorn/no-null -- his encounter's decision row moves him
  brain: null,
  // oxlint-disable-next-line unicorn/no-null -- no separately installed strike
  strike: null,
  seed: 1,
  scale: 1,
  at: [0, 0, 0],
  yaw: 0,
}
const fight = {
  id: 'fixture.fight',
  entity: 'fixture.boss',
  kind: 'boss',
  // oxlint-disable-next-line unicorn/no-null -- no ui panel
  panel: null,
  name: 'Boss',
  title: 'Boss',
  retry: 'Again',
  start: 'spawned',
  arena: { at: [0, 0, 0], radius: 20 },
  intro: 1,
  introShort: 0.5,
  respawn: { at: [0, 0, 25], yaw: 0 },
  phases: [
    {
      at: 1,
      name: 'one',
      caption: 'One',
      speed: 0,
      stopDistance: 0,
      turnRate: 0,
    },
  ],
}
const cost = {
  webContentMB: 400,
  glMB: 50,
  engineBaseMB: 299,
  rev: '151dd6058',
  device: 'fixture',
  evidence: 'progress/memory/fixture.json',
  epoch: 3,
}
const rise = {
  id: 1,
  name: 'rise',
  type: 'f64',
  privacy: 'public',
  default: 0,
  min: 0,
  max: 1,
} as const

function fixture(encounter: boolean): Shardfile {
  const source = outputFixture()
  source.rows = structuredClone(rows)
  source.runtime = parse(RuntimeSchema, {
    kind: 'client-plan',
    cost,
    binds: ['state', 'spawns'],
    spawns: { homes: [], bosses: [] },
  })
  source.state = { ...source.state, shared: [rise] }
  source.creatures = parse(CreaturesSchema, {
    brains: [],
    groups: [],
    spawns: [spawn],
  })
  source.encounters = encounter ? parse(EncountersSchema, [fight]) : []
  return source
}

test("a declared boss encounter's spawn holds public numeric fields as a retained actor", (): void => {
  expect(shardfileRules(fixture(true))).not.toContain(RULE)
  expect(
    shardfileRules(fixture(false)),
    'a spawn with no boss encounter is no retained actor',
  ).toContain(RULE)
})

test("asset admission counts a declared boss encounter's spawn as a retained actor", (): void => {
  expect([...retainedActorIds([], ['fixture.boss'], ['fixture.boss'])]).toEqual(
    ['fixture.boss'],
  )
  expect([...retainedActorIds(['runtime.boss'], [], ['fixture.boss'])]).toEqual(
    ['runtime.boss'],
  )
})
