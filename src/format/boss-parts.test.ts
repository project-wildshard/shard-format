import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { EncountersSchema } from './encounters.ts'
import { derivePrimitives } from './primitives.ts'

// ONE-FORMAT OF34a (J420 (1)): a boss is `boss` (start, capExempt) + `boss.arena` (bounds) + any ability's tells.
const warden = {
  id: 'warden',
  entity: 'warden:1',
  kind: 'boss',
  // oxlint-disable-next-line unicorn/no-null -- an encounter row's panel is JSON null when it has none
  panel: null,
  name: 'Warden',
  title: 'The Warden',
  retry: 'Try again',
  arena: { at: [0, 0, 0], radius: 20 },
  intro: 1,
  introShort: 0.5,
  respawn: { at: [0, 0, 25], yaw: 0 },
  phases: [
    {
      at: 1,
      name: 'one',
      caption: 'One',
      speed: 3,
      stopDistance: 2,
      turnRate: 4,
    },
  ],
}

function issue(rows: unknown): string | undefined {
  const parsed = safeParse(EncountersSchema, rows)
  return parsed.success ? undefined : parsed.issues[0].message
}
function families(rows: readonly unknown[]): string[] {
  return derivePrimitives(
    new Map([['combat/encounters', { encounters: rows }]]),
  )
    .map((row): string => row.name)
    .filter((name): boolean => name.startsWith('boss'))
}

test('OF34a: every boss start, capExempt and both arena bounds parse', (): void => {
  for (const start of ['placed', 'spawned', 'resident']) {
    expect(issue([{ ...warden, start }])).toBeUndefined()
  }
  expect(issue([{ ...warden, capExempt: true }])).toBeUndefined()
  for (const bounds of ['room', 'open']) {
    expect(
      issue([{ ...warden, arena: { ...warden.arena, bounds } }]),
    ).toBeUndefined()
  }
})

test('OF34a: an unknown start or bounds, and an elite with a start, refuse by name', (): void => {
  expect(issue([{ ...warden, start: 'summoned' }])).toBe('Unknown boss start')
  expect(
    issue([{ ...warden, arena: { ...warden.arena, bounds: 'cave' } }]),
  ).toBe('Unknown arena bounds')
  expect(issue([{ ...warden, kind: 'elite', start: 'spawned' }])).toBe(
    'Only a boss has a start or capExempt',
  )
  expect(issue([{ ...warden, kind: 'elite', capExempt: true }])).toBe(
    'Only a boss has a start or capExempt',
  )
})

test('OF34a: a row without the new fields parses byte-identical', (): void => {
  const parsed = safeParse(EncountersSchema, [warden])
  expect(parsed.success).toBe(true)
  expect(JSON.stringify(parsed.output)).toBe(JSON.stringify([warden]))
})

test('OF34a: arena bounds switch boss.arena on; a boss without bounds is boss alone', (): void => {
  expect(families([warden])).toEqual(['boss'])
  expect(
    families([{ ...warden, arena: { ...warden.arena, bounds: 'room' } }]),
  ).toEqual(['boss', 'boss.arena'])
})
