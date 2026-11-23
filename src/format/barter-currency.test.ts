/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- FP31 fixture: inline valibot issue mapping */
import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { BarterEconomySchema } from './lootEconomy.ts'

const coin = {
  id: 'coin',
  name: 'Coin',
  model: 'shared/doubloon',
  icon: 'coin',
}
const issues = (row: object): string[] =>
  (safeParse(BarterEconomySchema, row).issues ?? []).map(
    (issue): string =>
      `${issue.path?.map(step => String(step.key)).join('.') ?? ''} ${issue.message}`,
  )

test('a barter economy may name its currency, as a loot economy does (FP31)', (): void => {
  const barter = { kind: 'barter', goods: [], exchange: {}, tables: [] }
  expect(issues({ ...barter, currency: coin })).toEqual(issues(barter))
  expect(
    issues({ ...barter, currency: { ...coin, name: '' } }).some(line =>
      line.startsWith('currency'),
    ),
  ).toBe(true)
})
