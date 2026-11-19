/* oxlint-disable id-length, unicorn/no-null -- Fixture uses the declared prop wire, including axis names and absent panels. */
import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { PropsSchema } from './props.ts'

const hull = {
  kind: 'hull',
  x: 18.4,
  y: 125,
  z: -22.6,
  surface: 'stone',
  points: Array.from({ length: 8 }, (_unused, index): number[] => {
    const angle = (index * Math.PI) / 4
    const x = Math.cos(angle) * 3.5,
      z = Math.sin(angle) * 3.5
    return [x, 0, z, x, 1, z]
  }).flat(),
}

function props(shape: unknown): unknown {
  return {
    version: 1,
    family: 'scene',
    tiles: [],
    models: [],
    far: null,
    textures: [],
    panels: [],
    colliders: [
      {
        id: 'banyan.paifang',
        panel: null,
        initialActive: true,
        shapes: [shape],
      },
    ],
  }
}

test('preserves the Nine Dragon prop hull and its material', (): void => {
  const parsed = safeParse(PropsSchema, props(hull))
  expect(parsed.success).toBe(true)
  if (parsed.success) {
    expect(parsed.output.colliders[0]?.shapes[0]).toEqual(hull)
  }
})

test.each([
  { ...hull, points: [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1] },
  { ...hull, points: [...hull.points, 1] },
  { ...hull, points: [...hull.points, 1e100, 0, 0] },
  {
    ...hull,
    points: Array.from({ length: 17 }, (): number[] => hull.points).flat(),
  },
  { ...hull, points: [...hull.points, 0, Infinity, 0] },
  { ...hull, x: 248 },
  { ...hull, x: 248, z: 0, yaw: Math.PI / 2 },
])(
  'refuses malformed, flat and out of bounds hulls',
  (shape: Readonly<{ points: readonly number[] }>): void => {
    expect(safeParse(PropsSchema, props(shape)).success).toBe(false)
  },
)
