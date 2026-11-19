/* oxlint-disable id-length, unicorn/no-null -- Fixture uses the declared prop wire, including axis names and absent panels. */
import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { PropsSchema } from './props.ts'

// OF22a3: Driftwood's baked solids, as plain prop colliders: a capsule palm trunk, a planks hull, a ground path box.
const capsule = {
  kind: 'capsule',
  x: 12,
  y: 3.5,
  z: -40,
  halfHeight: 3,
  radius: 0.35,
  rot: { x: 0, y: 0, z: 0, w: 1 },
  surface: 'wood',
  friction: 0.5,
  groups: 131_071,
}
const pier = {
  kind: 'hull',
  x: 0,
  y: 1.2,
  z: -235,
  surface: 'planks',
  friction: 0.5,
  groups: 131_071,
  points: Array.from({ length: 168 }, (_unused, index): number[] => {
    const angle = (index * Math.PI * 2) / 84
    return [Math.cos(angle) * 2, index < 84 ? 0 : 0.4, Math.sin(angle) * 2]
  }).flat(),
}
const path = {
  kind: 'box',
  x: 4,
  y: 0.1,
  z: 9,
  hx: 1,
  hy: 0.1,
  hz: 3,
  surface: 'ground',
  friction: 0.9,
}

interface Fixture {
  colliders: unknown[]
}
function props(
  shapes: readonly unknown[],
  rows = 1,
): Fixture & Record<string, unknown> {
  return {
    version: 1,
    family: 'island',
    tiles: [],
    models: [],
    far: null,
    textures: [],
    panels: [],
    colliders: Array.from({ length: rows }, (_unused, index): unknown => ({
      id: `piece.solids.${String(index)}`,
      panel: null,
      initialActive: true,
      shapes,
    })),
  }
}

test('keeps a baked capsule, hull and box with their material, friction and groups', (): void => {
  const parsed = safeParse(
    PropsSchema,
    props([
      capsule,
      pier,
      path,
      { ...capsule, surface: 'flesh' },
      { ...path, surface: 'shell' },
    ]),
  )
  expect(parsed.success).toBe(true)
  if (parsed.success) {
    expect(parsed.output.colliders[0]?.shapes).toEqual([
      capsule,
      pier,
      path,
      { ...capsule, surface: 'flesh' },
      { ...path, surface: 'shell' },
    ])
  }
})

test.each([
  { ...capsule, radius: 0 },
  { ...capsule, halfHeight: -1 },
  { ...capsule, x: 249.8 },
  {
    ...capsule,
    x: 248,
    halfHeight: 3,
    rot: { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 },
  },
  { ...capsule, friction: 2.5 },
  { ...capsule, friction: -0.1 },
  { ...capsule, groups: 2 ** 32 },
  { ...capsule, groups: 1.5 },
  { ...capsule, surface: 'edge' },
  { ...path, friction: Number.NaN },
  {
    ...pier,
    points: Array.from(
      { length: 257 * 3 },
      (_unused, index): number => (index % 7) - 3,
    ),
  },
])(
  'refuses a solid off its cell, an unknown material or contact out of range',
  (shape: unknown): void => {
    expect(safeParse(PropsSchema, props([shape])).success).toBe(false)
  },
)

test('a baked island fits the collider budget, and one unit more than it refuses', (): void => {
  // 16,384 units: 64 rows of one 256-point hull, then one box more (the JSON node bound stays the props section's own limit)
  const drum = {
    ...pier,
    points: Array.from({ length: 256 }, (_unused, index): number[] => {
      const angle = (index * Math.PI * 2) / 128
      return [Math.cos(angle) * 2, index < 128 ? 0 : 0.4, Math.sin(angle) * 2]
    }).flat(),
  }
  const fits = props([drum], 64)
  expect(safeParse(PropsSchema, fits).success).toBe(true)
  fits.colliders.push({
    id: 'piece.over',
    panel: null,
    initialActive: true,
    shapes: [path],
  })
  expect(safeParse(PropsSchema, fits).success).toBe(false)
})
