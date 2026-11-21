// ONE-FORMAT OF30: a runtime plan whose creatures are all declared rows (Sky Reach, the Dunes) names no keeper programme.
import { expect, test } from 'vitest'

import {
  nativeRuntimeActorIds,
  parseNativeRuntimePlan,
} from './nativeRuntimePlan.ts'

/** A plan section with no owner row and no keeper programme, as its JSON; `rows` adds population rows. */
function plan(rows: string): unknown {
  const section: unknown = JSON.parse(
    '{"kind":"held-melee","baked":{},"recipe":{"terrain":"none","ground":{"size":64,"height":0},' +
      '"player":{"speed":5},"runtime":{"weapon":{"id":"whip"},"quest":{"spots":"metadata"}},"population":{"sources":"actors",' +
      `"seed":"declared","rows":{"step":"homes","seed":1,"homes":[],"attackers":null,"think":"legacy","admission":"prepare"${rows}}}}}`,
  )
  return section
}

test('a plan with no keeper programme parses and names only its homes', (): void => {
  const parsed = parseNativeRuntimePlan(
    plan(
      ',"homes":[{"id":"ray","kind":"ray","at":[0,0],"yaw":0,"respawn":30}]',
    ),
  )
  expect(parsed.recipe.population.rows.program).toBeUndefined()
  expect(nativeRuntimeActorIds(parsed)).toEqual(['ray'])
})

test('a keeper programme that is there is still checked', (): void => {
  expect((): unknown =>
    parseNativeRuntimePlan(plan(',"program":{"species":[]}')),
  ).toThrow()
})
