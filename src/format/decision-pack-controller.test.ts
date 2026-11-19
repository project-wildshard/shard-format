// ONE-FORMAT OF19b: a decision pack. A spawn-group decision row drives each member body (Dunes' skitterers): the
// species' temperament is `none` and the spawn names the group, so the group's row is its one controller.
import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { CreaturesSchema } from './creatures.ts'
import { parseRows } from './rows.ts'
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
const body = {
  id: 'fixture.actor',
  species: 'fixture.creature',
  variant: 'plain',
  at: [0, 0, 0],
  yaw: 0,
  scale: 1,
  seed: 1,
}

function packFixture(group?: string): Shardfile {
  const source = outputFixture()
  source.rows = structuredClone(rows)
  const spawn = {
    ...body,
    ...(group === undefined ? {} : { group }),
    // oxlint-disable-next-line unicorn/no-null -- The pack's decision row owns this body, not a named brain.
    brain: null,
    // oxlint-disable-next-line unicorn/no-null -- This body has no separately installed strike.
    strike: null,
  }
  source.creatures = parse(CreaturesSchema, {
    brains: [],
    groups: [],
    spawns: [spawn],
  })
  return source
}
function packScripts(
  actors: Readonly<Record<string, string>>,
  group = 'fixture.pack',
): ReadonlyMap<string, unknown> {
  return new Map([
    [
      'sim/scripts',
      [{ id: 'fixture.pack.decision', binding: { spawnGroup: group }, actors }],
    ],
  ])
}

test('a none-temperament spawn in a decision spawn group is owned by the group row', (): void => {
  const source = packFixture('fixture.pack')
  expect(shardfileRules(source)).toEqual([])
  expect(
    shardfileRules(source, packScripts({ body0: 'fixture.actor' })),
  ).toEqual([])
})

test('a decision pack member refuses without its group row', (): void => {
  const source = packFixture('fixture.pack')
  const elsewhere = [
    packScripts({ body0: 'fixture.other' }),
    packScripts({ body0: 'fixture.actor' }, 'fixture.elsewhere'),
    new Map([['sim/scripts', []]]),
  ]
  for (const scripts of elsewhere) {
    expect(shardfileRules(source, scripts)).toContain(
      'exactly one declared creature controller',
    )
  }
  expect(shardfileRules(packFixture())).toContain(
    'exactly one declared creature controller',
  )
})
