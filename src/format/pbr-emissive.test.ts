import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { PbrMaterialSchema } from './materialFamilies.ts'

// Meta SHARD-SOURCE M4.3: a PBR surface's own glow; absent, it parses with no emissive keys (older files keep their bytes).
test('a pbr surface without a glow parses with no emissive keys', (): void => {
  const plain = parse(PbrMaterialSchema, { family: 'pbr' })
  expect('emissive' in plain).toBe(false)
  expect('emissiveIntensity' in plain).toBe(false)
})

test('a glow parses, its intensity optional', (): void => {
  const lit = parse(PbrMaterialSchema, {
    family: 'pbr',
    emissive: [1, 0.65, 0.23],
    emissiveIntensity: 2.6,
  })
  expect([lit.emissive, lit.emissiveIntensity]).toEqual([[1, 0.65, 0.23], 2.6])
  const tint = parse(PbrMaterialSchema, {
    family: 'pbr',
    emissive: [0.2, 0.1, 0],
  })
  expect('emissiveIntensity' in tint).toBe(false)
})

test('a bad glow is refused', (): void => {
  for (const bad of [
    { emissive: [2, 0, 0] },
    { emissive: [1, 1] },
    { emissiveIntensity: -1 },
    { emissiveIntensity: 65 },
    { emissiveIntensity: Number.NaN },
  ]) {
    expect((): unknown =>
      parse(PbrMaterialSchema, { family: 'pbr', ...bad }),
    ).toThrow()
  }
})
