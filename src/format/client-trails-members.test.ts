// ONE-FORMAT OF29e7a: a trail row names the declared spawns it follows (`members`) in place of a page population's group,
// so Sky Reach's ray wake needs no `population.homes` row. FORMAT-PRUNE FP43 retired that row and its groups: members only.
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

test('a trail names its members; the page population group is retired (FP43)', (): void => {
  expect(admits({ members: ['far.ray.0', 'far.ray.1'] })).toBe(true)
  expect(admits({})).toBe(false)
  expect(admits({ group: 'rays' })).toBe(false)
  expect(admits({ group: 'rays', members: ['far.ray.0'] })).toBe(false)
  expect(admits({ members: [] })).toBe(false)
})
