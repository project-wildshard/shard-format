// FORMAT-PRUNE FP40: a far row may carry its own look, so the grid draws a built-in neighbour's far proxy from its
// product with its family, haze, grade and border band instead of from engine's `public/assets/baked/<slug>/far.json`.
import { is, parse } from 'valibot'
import { expect, test } from 'vitest'

import { FarSchema } from './shardSections.ts'

const hash = 'a'.repeat(64)
const far = {
  files: [hash],
  bounds: { min: [-250, -20, -250], max: [250, 60, 250] },
  compressed: 1,
  decoded: 1,
  gpu: 1,
  triangles: 2,
  draws: 1,
}
const look = {
  family: 'toon',
  haze: { colour: [0.6, 0.56, 0.64] },
  grade: {
    exposure: -0.3,
    saturation: 1.05,
    contrast: 1.1,
    tint: [1.02, 0.88, 1.1],
  },
  band: { colour: [0.72, 0.68, 0.78], height: 38, opacity: 0.8, own: 0.8 },
}

test('a far row reads with or without its look', (): void => {
  expect(parse(FarSchema, far)).toEqual(far)
  expect(parse(FarSchema, { ...far, look })).toEqual({ ...far, look })
  expect(
    parse(FarSchema, {
      ...far,
      look: { family: 'pbr', haze: { colour: [0.55, 0.62, 0.68] } },
    })?.look,
  ).toEqual({ family: 'pbr', haze: { colour: [0.55, 0.62, 0.68] } })
})

test('a far look refuses an unknown family, an out-of-range band and stray words', (): void => {
  expect(is(FarSchema, { ...far, look: { ...look, family: 'emissive' } })).toBe(
    false,
  )
  expect(
    is(FarSchema, {
      ...far,
      look: { ...look, band: { ...look.band, opacity: 1.5 } },
    }),
  ).toBe(false)
  expect(is(FarSchema, { ...far, look: { ...look, extra: 1 } })).toBe(false)
})
