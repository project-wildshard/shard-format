import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { CreaturesSchema } from './creatures.ts'

import type { ShardCreatures } from './creatures.ts'

// ONE-FORMAT OF11a: a species row id may carry capitals (Dunes' `sunscar.creature.duneStrider`), so the spawn that
// places it names it the same way. The spawn's own id and its brain stay lowercase.
const spawn = {
  id: 'home.strider.0',
  species: 'sunscar.creature.duneStrider',
  variant: 'dusk',
  // oxlint-disable-next-line unicorn/no-null -- A spawn with no brain of its own declares null.
  brain: null,
  // oxlint-disable-next-line unicorn/no-null -- It names no strike either.
  strike: null,
  seed: 3,
  scale: 1,
  at: [0, 0, 0],
  yaw: 0,
}

function creatures(row: unknown): ShardCreatures {
  return parse(CreaturesSchema, { brains: [], spawns: [row] })
}

test('OF11a: a spawn names a species by its row id, capitals included', (): void => {
  expect(creatures(spawn).spawns[0]?.species).toBe(
    'sunscar.creature.duneStrider',
  )
})

test('OF11a: the spawn id stays lowercase; a species id starts lowercase', (): void => {
  expect((): ShardCreatures =>
    creatures({ ...spawn, id: 'home.Strider' }),
  ).toThrow()
  expect((): ShardCreatures =>
    creatures({ ...spawn, species: 'Sunscar.x' }),
  ).toThrow()
})
