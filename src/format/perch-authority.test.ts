import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { CreaturesSchema } from './creatures.ts'
import { fixture, perch } from './fixtures/perch-authority.ts'

function objectAt(input: unknown): object {
  if (input === null || typeof input !== 'object') {
    throw new Error('Invalid fixture path')
  }
  return input
}

function changed(path: readonly string[], value: unknown): unknown {
  const input = structuredClone(fixture())
  let parent: unknown = input
  for (const key of path.slice(0, -1)) {
    parent = Reflect.get(objectAt(parent), key)
  }
  const leaf = path.at(-1)
  if (leaf === undefined) {
    throw new Error('Invalid fixture leaf')
  }
  Reflect.set(objectAt(parent), leaf, value)
  return input
}

function refuses(input: unknown): void {
  expect((): void => {
    parse(CreaturesSchema, input)
  }).toThrow()
}

test.each([false, true])(
  'complete declared perch authority parses without mutation; alias=%s',
  (alias: boolean): void => {
    const input = fixture(alias)
    const before = JSON.stringify(input)
    const parsed = parse(CreaturesSchema, input)
    expect(parsed.perchBodies).toEqual([perch])
    expect(parsed.spawns[0]?.perchBody).toBe('fixture.perch')
    expect(JSON.stringify(input)).toBe(before)
  },
)

const malformed = [
  [['perchBodies'], undefined],
  [['perchBodies', '0', 'projectile'], {}],
  [['perchBodies', '0', 'policy'], {}],
  [['perchBodies', '0', 'program', 'bytes'], undefined],
  [['perchBodies', '0', 'sites'], []],
  [['perchBodies', '0', 'sites', '0', 'at', '1'], Number.NaN],
  [['perchBodies', '0', 'sites', '0', 'base', '0'], 251],
  [['perchBodies', '0', 'program'], {}],
  [['perchBodies', '0', 'program', 'script', 'side'], 'view'],
  [['perchBodies', '0', 'program', 'script', 'commands'], ['invented']],
  [['perchBodies', '0', 'policy', 'attackStream'], undefined],
  [['perchBodies', '0', 'policy', 'root', 'height'], 'foreign'],
  [['perchBodies', '0', 'policy', 'root', 'gravity'], -1],
  [['perchBodies', '0', 'policy', 'root', 'speed'], 0],
  [['perchBodies', '0', 'policy', 'root', 'landing'], -1],
  [
    ['perchBodies', '0', 'policy', 'actions', 'actions', '0', 'effect'],
    'invented',
  ],
  [['perchBodies', '0', 'policy', 'actions', 'actions', '0', 'state'], 3],
  [['perchBodies', '0', 'policy', 'actions', 'actions', '0', 'phase'], 1.1],
  [
    ['perchBodies', '0', 'policy', 'actions', 'actions', '0', 'once', 'key'],
    'foreign',
  ],
  [['perchBodies', '0', 'projectile', 'pool', 'count'], 129],
  [['perchBodies', '0', 'projectile', 'launch', 'speed'], 0],
  [
    ['perchBodies', '0', 'projectile', 'launch', 'time'],
    [2, 1],
  ],
  [['perchBodies', '0', 'projectile', 'strike'], ''],
  [['spawns', '0', 'perchBody'], 'missing'],
  [['spawns', '0', 'species'], 'foreign.kind'],
  [['spawns', '0', 'home'], undefined],
] as const

test.each(malformed)(
  'malformed or unresolved authority refuses: %j',
  (path: readonly string[], value: unknown): void => {
    refuses(changed(path, value))
  },
)

test('duplicate body catalogue identities refuse', (): void => {
  refuses({ ...fixture(), perchBodies: [perch, perch] })
})

test('the catalogue bounds the total physical pool across definitions', (): void => {
  const other = {
    ...perch,
    id: 'fixture.other',
    projectile: {
      ...perch.projectile,
      pool: { ...perch.projectile.pool, count: 128 },
    },
  }
  refuses({ ...fixture(), perchBodies: [perch, other] })
})

test('two declared actors select one shared physical pool', (): void => {
  const parsed = parse(CreaturesSchema, fixture())
  const [first] = parsed.spawns
  if (first === undefined) {
    throw new Error('Missing first fixture actor')
  }
  const troop = parse(CreaturesSchema, {
    ...fixture(),
    spawns: [first, { ...first, id: 'fixture.other' }],
  })
  expect(troop.spawns).toHaveLength(2)
  expect(troop.perchBodies).toHaveLength(1)
  expect(troop.perchBodies?.[0]?.projectile.pool.count).toBe(16)
})

test('duplicate occupied site identities refuse', (): void => {
  refuses(
    changed(['perchBodies', '0', 'sites'], [perch.sites[0], perch.sites[0]]),
  )
})
