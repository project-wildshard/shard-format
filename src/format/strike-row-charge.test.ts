import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { parseRows } from './rows.ts'

import type { StrikeRows } from './rows.ts'

// ONE-FORMAT OF11b: Dunes' strider charge as a plain strike row: a lane charge runs past its target (`overshoot`).
// Its distance score is the challenge brain's own tuning (engine grazer.ts), so the row needs no score of its own.
function charge(): StrikeRows {
  return {
    id: 'sunscar.strider.charge',
    shape: { kind: 'lane', length: 13, width: 2.2 },
    windup: 1.1,
    active: 1.2,
    recover: 1.8,
    cooldown: 3.5,
    range: 17,
    damage: 22,
    tags: ['creature.duneStrider'],
    weight: 0.2,
    speed: 11,
    overshoot: 3,
  }
}

test('a plain strike row carries a charge overshoot', (): void => {
  const rows = parseRows({ ...outputFixture().rows, strikes: [charge()] })
  expect(rows.strikes[0]?.overshoot).toBe(3)
})

test('a strike row without one keeps its bytes', (): void => {
  const { overshoot: _overshoot, ...plain } = charge()
  const rows = parseRows({ ...outputFixture().rows, strikes: [plain] })
  expect(Object.keys(rows.strikes[0] ?? {})).not.toContain('overshoot')
})

test('overshoot is bounded', (): void => {
  const fixture = outputFixture().rows
  expect((): unknown =>
    parseRows({ ...fixture, strikes: [{ ...charge(), overshoot: -1 }] }),
  ).toThrow()
  expect((): unknown =>
    parseRows({ ...fixture, strikes: [{ ...charge(), overshoot: 31 }] }),
  ).toThrow()
})

// OF11b: Dunes' ray swoop is sized in metres whatever the ray's scale; a row says so with `units`.
test('a plain strike row names how its shape follows the body scale', (): void => {
  const fixture = outputFixture().rows
  const units = (row: unknown): unknown =>
    parseRows({ ...fixture, strikes: [row] }).strikes[0]?.units
  expect(units({ ...charge(), units: 'world' })).toBe('world')
  expect(units({ ...charge(), units: 'actor' })).toBe('actor')
  expect(units(charge())).toBeUndefined()
  expect((): unknown => units({ ...charge(), units: 'body' })).toThrow()
})
