import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { CreaturesSchema } from './creatures.ts'

// TEMPLATE-E2E TC-E2 (J361): a data spawn may say how many seconds after its death its body comes back (1 to 3600).
const body = {
  id: 'bandit-1',
  species: 'bandit',
  variant: 'base',
  // oxlint-disable-next-line unicorn/no-null -- The format's spawn row names no brain with null.
  brain: null,
  // oxlint-disable-next-line unicorn/no-null -- The format's spawn row names no strike with null.
  strike: null,
  seed: 1,
  scale: 1,
  at: [0, 0, 0],
  yaw: 0,
}
const creatures = (spawn: Readonly<Record<string, number>>): unknown => ({
  brains: [],
  spawns: [{ ...body, ...spawn }],
})

test('a spawn may respawn 1 to 3600 seconds after its death', (): void => {
  expect(
    parse(CreaturesSchema, creatures({ respawn: 30 })).spawns[0]?.respawn,
  ).toBe(30)
  expect(
    parse(CreaturesSchema, creatures({})).spawns[0]?.respawn,
  ).toBeUndefined()
  for (const respawn of [0, 0.5, 3601, Number.NaN]) {
    expect(safeParse(CreaturesSchema, creatures({ respawn })).success).toBe(
      false,
    )
  }
})
