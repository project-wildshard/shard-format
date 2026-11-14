import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { EmissiveMaterialSchema, PbrMaterialSchema } from './materialFamilies.ts'

// Meta SHARD-SOURCE AP10 to AP12: alpha surfaces, decal offsets, sway, uv scroll, cards and their motion. Absent, a
// surface parses with none of these keys (older files keep their bytes).
test('a plain pbr or emissive surface parses with no scene-render keys', (): void => {
  const pbr = parse(PbrMaterialSchema, { family: 'pbr' })
  for (const key of ['blend', 'opacity', 'depthOffset', 'sway', 'uvScroll']) expect(key in pbr).toBe(false)
  const glow = parse(EmissiveMaterialSchema, { family: 'emissive' })
  expect('card' in glow).toBe(false)
  expect('motion' in glow).toBe(false)
  expect(glow.blend).toBe('opaque')
})

test('a decal, a swaying frond and a scrolling map parse', (): void => {
  const decal = parse(PbrMaterialSchema, { family: 'pbr', blend: 'alpha', opacity: 0.9, depthOffset: -2 })
  expect([decal.blend, decal.opacity, decal.depthOffset]).toEqual(['alpha', 0.9, -2])
  const frond = parse(PbrMaterialSchema, { family: 'pbr', sway: { rate: 0.8, direction: [0.8, 0.6] }, uvScroll: [0.1, 0] })
  expect(frond.sway).toEqual({ rate: 0.8, direction: [0.8, 0.6] })
  expect(frond.uvScroll).toEqual([0.1, 0])
})

test('cards parse with each motion, and alpha blending', (): void => {
  for (const motion of [
    { kind: 'pulse', rate: 1.4, amount: 0.12 },
    { kind: 'drift', rate: 0.3, radius: 0.6 },
    { kind: 'rise', rate: 0.4, height: 2.6, spread: 0.5 },
  ]) {
    const card = parse(EmissiveMaterialSchema, { family: 'emissive', blend: 'alpha', card: true, motion })
    expect(card.card).toBe(true)
    expect(card.motion).toEqual(motion)
    expect(card.blend).toBe('alpha')
  }
})

test('bad scene-render keys are refused', (): void => {
  for (const bad of [{ blend: 'additive' }, { opacity: 2 }, { depthOffset: 40 }, { sway: { rate: 1 } }, { uvScroll: [1] }]) {
    expect((): unknown => parse(PbrMaterialSchema, { family: 'pbr', ...bad })).toThrow()
  }
  for (const bad of [{ card: false }, { motion: { kind: 'spin', rate: 1 } }, { motion: { kind: 'rise', rate: 1, height: 1 } }]) {
    expect((): unknown => parse(EmissiveMaterialSchema, { family: 'emissive', ...bad })).toThrow()
  }
})
