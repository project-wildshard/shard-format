import { expect, test } from 'vitest'

import { deprecationsUsed } from './deprecations.ts'

// ONE-FORMAT OF9b5 (J486): each moved level manifest word warns, so FE7 counts its kept users before the delete.

const ids = (manifest: Readonly<Record<string, unknown>>): readonly string[] =>
  deprecationsUsed({
    index: {},
    sections: new Map([['ui/level', { manifest }]]),
  }).map((row): string => row.id)

test('OF9b5: a manifest still carrying moved words warns once per word', (): void => {
  expect(
    ids({
      spawn: { yaw: 0 },
      species: ['boar'],
      spawns: [],
      faunaTuning: {},
      shardfile: 'shard.json',
    }),
  ).toEqual([
    'manifest.spawn',
    'manifest.species',
    'manifest.spawns',
    'manifest.faunaTuning',
  ])
  expect(ids({ boot: {}, shardfile: 'shard.json' })).toEqual([])
})
