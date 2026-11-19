// ONE-FORMAT OF19b: a declared spawn's hold. A body's memory field reads 1 until a quest flag is set, then 0 (Dunes' first
// ray glides, held, until the player has met the scout); the runtime plan's population `holds` row, as a spawn row.
import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { CreaturesSchema } from './creatures.ts'
import { shardfileRules } from './shardSchema.ts'

import type { Shardfile } from './shardSchema.ts'

// oxlint-disable-next-line unicorn/no-null -- No named brain: only the hold is under test.
const brain = null
// oxlint-disable-next-line unicorn/no-null -- No installed strike: only the hold is under test.
const strike = null
const body = {
  id: 'fixture.actor',
  species: 'fixture.creature',
  variant: 'plain',
  at: [0, 0, 0],
  yaw: 0,
  scale: 1,
  seed: 1,
}

function held(hold: unknown): Shardfile['creatures'] {
  return parse(CreaturesSchema, {
    brains: [],
    groups: [],
    spawns: [{ ...body, brain, strike, hold }],
  })
}

test('a spawn hold names a memory field and the quest flag that frees it', (): void => {
  expect(held({ field: 'held', until: 'fixture.met' }).spawns[0]?.hold).toEqual(
    { field: 'held', until: 'fixture.met' },
  )
  for (const hold of [
    { field: 'held' },
    { field: '', until: 'fixture.met' },
    { field: 'constructor', until: 'fixture.met' },
    { field: 'held', until: 'fixture.met', extra: 1 },
  ]) {
    expect((): unknown => held(hold)).toThrow()
  }
})

test('a spawn hold flag is a declared quest flag', (): void => {
  const source = outputFixture()
  source.creatures = held({ field: 'held', until: 'fixture.met' })
  expect(shardfileRules(source)).toContain('declared spawn hold flag')
  source.quests.flags = ['fixture.met']
  expect(shardfileRules(source)).not.toContain('declared spawn hold flag')
})
