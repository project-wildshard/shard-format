import { expect, test } from 'vitest'

import { parseFamilyMaterial, presetRefusal } from './materialFamilies.ts'

import type { PbrMaterialParams } from './materialFamilies.ts'

// Meta TEMPLATE-E2E LF1-1: the measure layer's finish. Three optional knobs per role [structure, trim, floor]: a tint
// from the mesh's own colour, a grain, and a grid opacity down to 0. Every default is off, so a layer that names none of
// them parses with no finish key and draws as before.

const pbr = (measure: object): PbrMaterialParams => {
  const parsed = parseFamilyMaterial({
    family: 'pbr',
    vertexColours: true,
    measure,
  })
  if (parsed.family !== 'pbr' || parsed.measure === null) {
    throw new Error('not a measure surface')
  }
  return parsed
}

test('a layer without a finish parses as before: no key is filled, so an old product keeps its source hash', (): void => {
  const plain = pbr({}).measure
  expect(
    plain === null
      ? []
      : Object.keys(plain).filter(
          (key): boolean => key === 'tint' || key === 'grain' || key === 'grid',
        ),
  ).toEqual([])
  expect(presetRefusal(pbr({}))).toBeNull()
})

test('tint: a share of the mesh colour per role', (): void => {
  expect(pbr({ tint: [0.8, 0.6, 0] }).measure?.tint).toEqual([0.8, 0.6, 0])
  expect((): unknown => pbr({ tint: [1.2, 0, 0] })).toThrow(/tint/u)
  expect((): unknown => pbr({ tint: [0.5, 0.5] })).toThrow(/tint/u)
})

test('grain: an amount per role and one size', (): void => {
  expect(
    pbr({ grain: { amount: [0.2, 0.1, 0.3], size: 0.4 } }).measure?.grain,
  ).toEqual({ amount: [0.2, 0.1, 0.3], size: 0.4 })
  expect((): unknown => pbr({ grain: { amount: [0.2, 0.1, 0.3] } })).toThrow(
    /grain/u,
  )
  expect((): unknown =>
    pbr({ grain: { amount: [0.2, 0.1, 0.3], size: 0 } }),
  ).toThrow(/grain/u)
})

test('grid: a line opacity per role, down to 0', (): void => {
  expect(pbr({ grid: [0.2, 0.3, 0] }).measure?.grid).toEqual([0.2, 0.3, 0])
  expect((): unknown => pbr({ grid: [-0.1, 1, 1] })).toThrow(/grid/u)
})

test('a finished layer is not a graph preset yet; a plain one still is', (): void => {
  for (const finish of [
    { tint: [0.5, 0, 0] },
    { grain: { amount: [0, 0, 0.1], size: 1 } },
    { grid: [1, 0, 1] },
  ]) {
    const finished = pbr(finish)
    expect(presetRefusal(finished)).toMatch(/finish/u)
  }
  expect(presetRefusal(pbr({}))).toBeNull()
})
