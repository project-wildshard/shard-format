// ONE-FORMAT OF31f1 and OF31g1 (Q37): a shard's kept items and its currency are rows in its own file, not engine tables.

import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { parseItems } from './items.ts'
import { LootEconomySchema } from './lootEconomy.ts'

/** An items section with no rows, as its JSON; `kept` adds the kept rows. */
function items(kept?: string): unknown {
  const section: unknown = JSON.parse(
    `{"version":1,${kept === undefined ? '' : `"kept":${kept},`}"rows":[],"contexts":[],"loadout":{"primary":null,"secondary":null,"tools":[]}}`,
  )
  return section
}
const currency = LootEconomySchema.entries.currency.wrapped

test('items with no kept rows still parse', (): void => {
  expect(parseItems(items()).kept).toBeUndefined()
})

test('kept rows carry kind, label and an optional gauge', (): void => {
  const parsed = parseItems(
    items(
      '[{"id":"whetstone-1","kind":"upgrade","label":"Whetstone I","gauge":{"name":"sharpen","level":1}},' +
        '{"id":"cape","kind":"cosmetic","label":"Sailcloth cape"},{"id":"lever-rifle","kind":"gear","label":"Lever-action"}]',
    ),
  )
  expect(parsed.kept).toMatchObject([
    { id: 'whetstone-1', gauge: { name: 'sharpen', level: 1 } },
    { id: 'cape', kind: 'cosmetic' },
    { id: 'lever-rifle', label: 'Lever-action' },
  ])
})

test('kept rows refuse an unknown kind, a repeated id and a repeated gauge level', (): void => {
  expect((): unknown =>
    parseItems(items('[{"id":"x","kind":"potion","label":"X"}]')),
  ).toThrow()
  expect((): unknown =>
    parseItems(
      items(
        '[{"id":"x","kind":"gear","label":"X"},{"id":"x","kind":"gear","label":"Y"}]',
      ),
    ),
  ).toThrow()
  expect((): unknown =>
    parseItems(
      items(
        '[{"id":"a","kind":"upgrade","label":"A","gauge":{"name":"hearts","level":1}},' +
          '{"id":"b","kind":"upgrade","label":"B","gauge":{"name":"hearts","level":1}}]',
      ),
    ),
  ).toThrow()
})

test('a currency names its coin, pickup model and icon', (): void => {
  const doubloon = {
    id: 'coin',
    name: 'Doubloon',
    model: 'shared/doubloon',
    icon: 'coin',
  }
  expect(parse(currency, doubloon)).toEqual(doubloon)
  expect((): unknown =>
    parse(currency, { ...doubloon, model: '../doubloon' }),
  ).toThrow()
  expect((): unknown => parse(currency, { ...doubloon, name: '' })).toThrow()
})
