import { expect, test } from 'vitest'

import { deprecationsUsed } from './deprecations.ts'

// FORMAT-PRUNE FP15: the species-program family's sections and page features each warn.

const ids = (sections: ReadonlyMap<string, unknown>): readonly string[] =>
  deprecationsUsed({ index: {}, sections }).map((row): string => row.id)

test('FP15: a species.program row in the runtime plan and a product-creatures feature warn', (): void => {
  const used = ids(
    new Map<string, unknown>([
      ['sim/runtime-plan', { rows: [{ kind: 'species.program', id: 'boar' }] }],
      ['client/plan', { features: [{ kind: 'population.product-creatures' }] }],
      ['actors/species-programs', {}],
    ]),
  )
  expect(used).toEqual([
    'feature.species.program',
    'feature.population.product-creatures',
    'section.actors/species-programs',
  ])
  expect(
    ids(new Map([['client/plan', { features: [{ kind: 'quest.page' }] }]])),
  ).toEqual([])
})
