import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { PropsSchema } from './props.ts'

// Meta SHARD-SOURCE SS9a: a touchable panel is one dynamic body the server keeps; each body names its own panel.
const most = 64
const nothing: unknown = JSON.parse('null')
const json = (text: string): unknown => JSON.parse(text)
const file = (index: number): string => index.toString(16).padStart(most, '0')
const crate = {
  id: 'yard.crate',
  panel: 'crate',
  at: json('{"x": 4, "y": 0.5, "z": -3}'),
  yaw: 0.3,
  shape: json('{"cuboid": {"x": 0.5, "y": 0.5, "z": 0.5}}'),
  material: 'wood',
  density: 400,
}
const barrel = {
  ...crate,
  id: 'yard.barrel',
  panel: 'barrel',
  shape: { cylinder: { radius: 0.4, halfHeight: 0.5 } },
  keep: true,
}
const solid = {
  id: 'crate.solid',
  panel: 'crate',
  initialActive: true,
  shapes: json(
    '[{"kind": "box", "x": 0, "y": 0, "z": 0, "hx": 1, "hy": 1, "hz": 1}]',
  ),
}
const props = (
  bodies: readonly unknown[],
  colliders: readonly unknown[] = [],
): object => ({
  version: 1,
  family: 'scene',
  tiles: [],
  models: [],
  far: nothing,
  textures: [],
  colliders,
  panels: [
    { id: 'crate', file: file(1) },
    { id: 'barrel', file: file(2) },
  ],
  bodies,
})
const admitted = (input: unknown): boolean =>
  safeParse(PropsSchema, input).success

test('a touchable crate and barrel name their panels', (): void => {
  const parsed = safeParse(PropsSchema, props([crate, barrel]))
  expect(parsed.success).toBe(true)
  const rows = parsed.success ? parsed.output.bodies : []
  expect(rows?.[0]?.panel).toBe('crate')
  expect(rows?.[1]?.panel).toBe('barrel')
})

test('bad bodies are refused', (): void => {
  for (const bad of [
    props([{ ...crate, panel: 'cart' }]),
    props([crate, { ...crate, id: 'yard.second' }]),
    props([crate, { ...crate, panel: 'barrel' }]),
    props([crate], [solid]),
    props([{ ...crate, shape: json('{"cuboid": {"x": 9, "y": 1, "z": 1}}') }]),
    props([{ ...crate, material: 'glass' }]),
    props([]),
  ]) {
    expect(admitted(bad)).toBe(false)
  }
})

test('a shard holds at most 64 bodies', (): void => {
  const rows = Array.from({ length: most }, (_unused, index): object => ({
    ...crate,
    id: `body${index}`,
    panel: `panel${index}`,
  }))
  const panels = Array.from({ length: most }, (_unused, index): object => ({
    id: `panel${index}`,
    file: file(index + most),
  }))
  expect(admitted({ ...props(rows), panels })).toBe(true)
  expect(admitted({ ...props([...rows, crate]), panels })).toBe(false)
})
