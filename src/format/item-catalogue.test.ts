/* oxlint-disable import/consistent-type-specifier-style, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion -- golden-vector oracle and fixtures (SDK-SPLIT SP4): written to match the engine side byte for byte */
// SDK-SPLIT SP4f3 (Q35): the item catalogue reader is a format law. item-catalogue.golden.json carries six item tables
// (the corpus's, Nalati's, Nine Dragon's, Pine Hollow's built section and the template's) beside the engine's own
// ItemCatalogue answers (item-catalogue.golden-gen.mjs), so this proves format's copy reads every one the same.
import { readFileSync } from 'node:fs'

import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  catalogueAnswers,
  type ItemTable,
} from './item-catalogue.golden-specs.ts'
import {
  ItemCatalogue,
  type ItemAmmoRow,
  type AmmoId,
} from './item-catalogue.ts'

it("types an ammunition row's tags as its ammo ids, as the engine's combat tags are", () => {
  expectTypeOf<ItemAmmoRow['tags']>().toEqualTypeOf<readonly AmmoId[]>()
})

interface Golden {
  readonly tables: readonly (ItemTable & { readonly answers: unknown })[]
}
const golden = JSON.parse(
  readFileSync(new URL('item-catalogue.golden.json', import.meta.url), 'utf8'),
) as Golden

describe('the item catalogue matches the engine', () => {
  for (const { name, table, answers } of golden.tables) {
    it(`${name}: every equipment, ammunition and inventory answer`, () => {
      expect(
        catalogueAnswers(input => new ItemCatalogue(input), table),
      ).toEqual(answers)
    })
  }
})
