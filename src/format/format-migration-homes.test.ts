import { expect, test } from 'vitest'

import { homesToMembers } from './format-migration-homes.ts'

import type { MigratingShard } from './format-migrations.ts'

/** Far Reach r6's rows, cut down: a homes row with two groups and a trail that follows one. */
function farReachPlan(): Record<string, unknown> {
  return {
    version: 1,
    features: [
      { kind: 'strings.register' },
      {
        kind: 'population.homes',
        system: 'far.creatures',
        groups: { rays: ['far.ray.0'], wisps: ['far.wisp.0', 'far.wisp.1'] },
      },
      {
        kind: 'fx.trail',
        rows: [
          { every: 0.07, group: 'rays', id: 'far.rayWake', points: 56 },
          { every: 0.1, group: 'nobody', id: 'stray', points: 8 },
        ],
      },
    ],
  }
}

test('FP43: the copy drops population.homes and its trails name the members (CP16)', (): void => {
  const plan = farReachPlan()
  const shard: MigratingShard = {
    index: {},
    sections: new Map([['client/plan', plan]]),
    mounts: new Map(),
  }
  homesToMembers.apply(shard)
  expect(plan['features']).toEqual([
    { kind: 'strings.register' },
    {
      kind: 'fx.trail',
      rows: [
        { every: 0.07, members: ['far.ray.0'], id: 'far.rayWake', points: 56 },
        // A group no homes row declared stays, and the copy's validator names it.
        { every: 0.1, group: 'nobody', id: 'stray', points: 8 },
      ],
    },
  ])
  expect(homesToMembers.to).toBe('0.1.0.5')
})

test('FP43: a plan with no homes row is unchanged', (): void => {
  const plan = { version: 1, features: [{ kind: 'strings.register' }] }
  const shard: MigratingShard = {
    index: {},
    sections: new Map([['server/plan', plan]]),
    mounts: new Map(),
  }
  homesToMembers.apply(shard)
  expect(plan).toEqual({ version: 1, features: [{ kind: 'strings.register' }] })
})
