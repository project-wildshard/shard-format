// ONE-FORMAT OF29e7a: a trail row names the declared spawns it follows (`members`) in place of a page population's group,
// so Sky Reach's ray wake needs no `population.homes` row to say which bodies are the rays. Exactly one of the two.
import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { ClientTrailsSchema } from './clientTrails.ts'

const ROW = {
  every: 0.07,
  id: 'far.rayWake',
  library: 'sky',
  look: 'ray-wake',
  minimum: 0.05,
  movementSq: 0,
  name: 'far.ray-wake',
  points: 56,
  width: 1.6,
}
/** Whether one trail row with `fields` admits. */
function admits(fields: Readonly<Record<string, unknown>>): boolean {
  return safeParse(ClientTrailsSchema, {
    kind: 'fx.trail',
    rows: [{ ...ROW, ...fields }],
  }).success
}

test('a trail names its group or its members, exactly one', (): void => {
  expect(admits({ group: 'rays' })).toBe(true)
  expect(admits({ members: ['far.ray.0', 'far.ray.1'] })).toBe(true)
  expect(admits({})).toBe(false)
  expect(admits({ group: 'rays', members: ['far.ray.0'] })).toBe(false)
  expect(admits({ members: [] })).toBe(false)
})
