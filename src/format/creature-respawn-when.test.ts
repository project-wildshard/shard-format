/* oxlint-disable unicorn/no-null, typescript/prefer-readonly-parameter-types -- Fixtures use the JSON spawn wire, with null brains. */
import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { CreaturesSchema } from './creatures.ts'

/** OF22b3: Driftwood's returns as declared rows: the practice crab (45 s, 30 m away, a 1.5 s fade), a crab (240 to 360 s, out of
 *  sight at 60 m) and the sailor (180 s, by night). */
function creatures(extra: Record<string, unknown>): unknown {
  return {
    brains: [],
    groups: [],
    spawns: [
      {
        id: 'crab.practice',
        species: 'crab',
        variant: 'small',
        brain: null,
        strike: null,
        seed: 1,
        scale: 1,
        at: [0, 0, 0],
        yaw: 0,
        ...extra,
      },
    ],
  }
}

test.each([
  { respawn: 45, respawnWhen: { away: 30, fade: 1.5 } },
  { respawn: 240, respawnWhen: { spread: 120, away: 60 } },
  { respawn: 180, respawnWhen: { night: true, away: 60 } },
  { respawn: 30 },
])('admits a timed return and its conditions %j', (row): void => {
  const parsed = safeParse(CreaturesSchema, creatures(row))
  expect(parsed.success).toBe(true)
  if (parsed.success) {
    expect(parsed.output.spawns[0]).toMatchObject(row)
  }
})

test.each([
  { respawnWhen: { away: 30 } },
  { respawn: 45, respawnWhen: { away: 251 } },
  { respawn: 45, respawnWhen: { fade: 61 } },
  { respawn: 45, respawnWhen: { spread: -1 } },
  { respawn: 45, respawnWhen: { night: false } },
  { respawn: 45, respawnWhen: { dusk: true } },
])('refuses a condition with no respawn or out of range %j', (row): void => {
  expect(safeParse(CreaturesSchema, creatures(row)).success).toBe(false)
})
