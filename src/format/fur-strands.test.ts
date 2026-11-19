import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { PbrMaterialSchema, ToonMaterialSchema } from './materialFamilies.ts'

// ONE-FORMAT OF3c2: a creature skin's fur grain, the engine factory's strand texture as numbers (kit boar's values).
const strands = {
  seed: 202,
  contrast: 1,
  grizzle: 0.6,
  normalStrength: 2.2,
  bristle: 0.6,
  strandLen: 12,
  root: 0.24,
}

test('toon and PBR surfaces carry fur strands', (): void => {
  expect(
    parse(ToonMaterialSchema, { family: 'toon', strands }).strands,
  ).toEqual(strands)
  expect(parse(PbrMaterialSchema, { family: 'pbr', strands }).strands).toEqual(
    strands,
  )
})

test('a surface without strands keeps its bytes', (): void => {
  expect(
    Object.keys(parse(ToonMaterialSchema, { family: 'toon' })),
  ).not.toContain('strands')
  expect(
    Object.keys(parse(PbrMaterialSchema, { family: 'pbr' })),
  ).not.toContain('strands')
})

test('strands are bounded', (): void => {
  expect(
    safeParse(ToonMaterialSchema, {
      family: 'toon',
      strands: { ...strands, strandLen: 0 },
    }).success,
  ).toBe(false)
  expect(
    safeParse(ToonMaterialSchema, {
      family: 'toon',
      strands: { ...strands, seed: 1.5 },
    }).success,
  ).toBe(false)
  expect(
    safeParse(ToonMaterialSchema, {
      family: 'toon',
      strands: { ...strands, contrast: 3 },
    }).success,
  ).toBe(false)
})
