import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { ClientFeatureSchema } from './clientPlan.ts'
import { CLIENT_FEATURE_SIDES, assertSectionSides } from './feature-sides.ts'

/** OF30 regression (v0.74.0's corpus gate): a kind a kept original names stays admitted and sided after its retire,
 *  until the J486 delete. Driftwood r4 to r6 name `population.product-creatures`; no corpus run should be the first to
 *  notice. */
const RETIRED_KEPT_KINDS = ['population.product-creatures'] as const

test('a retired client/plan kind that kept originals name stays sided and admitted', (): void => {
  for (const kind of RETIRED_KEPT_KINDS) {
    expect(CLIENT_FEATURE_SIDES).toHaveProperty([kind])
    expect((): void => {
      assertSectionSides('client/plan', { version: 1, features: [{ kind }] })
    }).not.toThrow()
    expect(safeParse(ClientFeatureSchema, { kind }).success).toBe(true)
  }
})
