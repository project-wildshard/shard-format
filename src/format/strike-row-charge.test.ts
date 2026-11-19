import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { parseRows } from './rows.ts'

import type { StrikeRows } from './rows.ts'

// ONE-FORMAT OF11b: Dunes' strider charge as a plain strike row. A lane charge runs past its target (`overshoot`) and
// scores by horizontal distance (`farWeight`: beyond `beyond` metres its weight is `weight`, nearer it is the row's).
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
    farWeight: { beyond: 5, weight: 2 },
  }
}

test('a plain strike row carries a charge overshoot and a far weight', (): void => {
  const rows = parseRows({ ...outputFixture().rows, strikes: [charge()] })
  expect(rows.strikes[0]?.overshoot).toBe(3)
  expect(rows.strikes[0]?.farWeight).toEqual({ beyond: 5, weight: 2 })
})

test('a strike row without them keeps its bytes', (): void => {
  const { overshoot: _overshoot, farWeight: _far, ...plain } = charge()
  const rows = parseRows({ ...outputFixture().rows, strikes: [plain] })
  expect(Object.keys(rows.strikes[0] ?? {})).not.toContain('overshoot')
  expect(Object.keys(rows.strikes[0] ?? {})).not.toContain('farWeight')
})

test('overshoot and far weight are bounded', (): void => {
  const fixture = outputFixture().rows
  expect((): unknown =>
    parseRows({ ...fixture, strikes: [{ ...charge(), overshoot: -1 }] }),
  ).toThrow()
  expect((): unknown =>
    parseRows({
      ...fixture,
      strikes: [{ ...charge(), farWeight: { beyond: 5, weight: -1 } }],
    }),
  ).toThrow()
})
