import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { CreaturesSchema } from './creatures.ts'
import { derivePrimitives } from './primitives.ts'

// ONE-FORMAT OF37a (Q-S10): a patrol is its own primitive, beside the encounter rows.
function wolf(index: number): Record<string, unknown> {
  return {
    id: `wolf:${String(index)}`,
    species: 'wolf',
    variant: 'grey',
    brain: 'pack',
    strike: 'bite',
    seed: index,
    scale: 1,
    at: [index, 0, 0],
    yaw: 0,
  }
}
const pack = {
  id: 'pack',
  kind: 'pursue',
  awareRadius: 12,
  leashRadius: 30,
  speed: 4,
  returnSpeed: 3,
  stopDistance: 1.5,
  turnRate: 4,
  thinkDivisor: 3,
  attackCooldownTicks: 60,
  wanderRadius: 0,
  wanderEveryTicks: 420,
}
const watch = {
  id: 'ridge-watch',
  members: ['wolf:1', 'wolf:2', 'wolf:3'],
  route: [
    [0, 0, 0],
    [20, 0, 0],
    [20, 0, 20],
  ],
  speed: 2,
  engage: 10,
  leash: 30,
}
function creatures(
  extra: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    brains: [pack],
    groups: [],
    spawns: [wolf(1), wolf(2), wolf(3)],
    ...extra,
  }
}
function issue(value: unknown): string | undefined {
  const parsed = safeParse(CreaturesSchema, value)
  return parsed.success ? undefined : parsed.issues[0].message
}

test('OF37a: a three-wolf patrol parses, and switches the patrol primitive on', (): void => {
  expect(issue(creatures({ patrols: [watch] }))).toBeUndefined()
  const names = derivePrimitives(
    new Map([
      ['actors/creatures', { creatures: creatures({ patrols: [watch] }) }],
    ]),
  ).map((row): string => row.name)
  expect(names).toContain('patrol')
  const without = new Map([['actors/creatures', { creatures: creatures({}) }]])
  expect(
    derivePrimitives(without).map((row): string => row.name),
  ).not.toContain('patrol')
})

test('OF37a: a short route, a leash inside engage and an unknown member refuse by name', (): void => {
  expect(
    issue(creatures({ patrols: [{ ...watch, route: [[0, 0, 0]] }] })),
  ).toBe('A patrol route needs two stops')
  expect(issue(creatures({ patrols: [{ ...watch, leash: 5 }] }))).toBe(
    'A patrol leash reaches at least its engage radius',
  )
  expect(
    issue(creatures({ patrols: [{ ...watch, members: ['wolf:9'] }] })),
  ).toBe('creature reference rules')
  expect(
    issue(creatures({ patrols: [watch, { ...watch, id: 'second' }] })),
  ).toBe('creature reference rules')
})

test('OF37a: creatures without patrols parse byte-identical', (): void => {
  const value = creatures({})
  const parsed = safeParse(CreaturesSchema, value)
  expect(parsed.success).toBe(true)
  expect(JSON.stringify(parsed.output)).toBe(JSON.stringify(value))
})
