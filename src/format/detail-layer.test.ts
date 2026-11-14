import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { PbrMaterialSchema } from './materialFamilies.ts'

// Meta TEMPLATES-CLEANROOM M4.11: a PBR surface's procedural detail layer; absent, it parses with no detail key.
const detail = {
  scale: 0.6,
  mottle: 0.35,
  grain: 0.2,
  relief: 0.6,
  moss: { colour: [0.3, 0.42, 0.12], amount: 0.5 },
}
const refuse = (extra: object): void => {
  expect((): unknown =>
    parse(PbrMaterialSchema, {
      family: 'pbr',
      detail: { ...detail, ...extra },
    }),
  ).toThrow()
}

test('a pbr surface without detail parses with no detail key', (): void => {
  expect('detail' in parse(PbrMaterialSchema, { family: 'pbr' })).toBe(false)
})

test('a detail layer parses, moss optional', (): void => {
  expect(parse(PbrMaterialSchema, { family: 'pbr', detail }).detail).toEqual(
    detail,
  )
  const plain = { scale: 1, mottle: 0.2, grain: 0, relief: 0 }
  expect(
    parse(PbrMaterialSchema, { family: 'pbr', detail: plain }).detail,
  ).toEqual(plain)
})

test('a bad detail layer is refused', (): void => {
  refuse({ scale: 0 })
  refuse({ mottle: 2 })
  refuse({ relief: 3 })
  refuse({ moss: { colour: [0, 0, 0] } })
})
