import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { WaterSchema } from './water.ts'

import type { PoolSurface } from './pool-surface.ts'

// Meta TEMPLATES-CLEANROOM M4.1: a pool may say how its surface draws; absent, it parses with no surface key.
const pool = (extra: object = {}): object => ({
  id: 'yard.pond',
  kind: 'pool',
  level: 0,
  shape: {
    kind: 'polygon',
    points: [
      [0, 0],
      [4, 0],
      [0, 4],
    ],
  },
  ...extra,
})
const surface = {
  reflect: 'planar',
  tint: [0.04, 0.035, 0.1],
  fresnel: [0.35, 3],
  ripple: { scale: 3, amplitude: 0.0022, speed: 1.2 },
}
const surfaceOf = (input: object): PoolSurface | undefined => {
  const [row] = parse(WaterSchema, [input])
  return row?.kind === 'pool' ? row.surface : undefined
}
const refuse = (extra: object): void => {
  expect((): unknown =>
    parse(WaterSchema, [pool({ surface: { ...surface, ...extra } })]),
  ).toThrow()
}

test('a pool without a surface parses with no surface key', (): void => {
  const [row] = parse(WaterSchema, [pool()])
  expect(row !== undefined && 'surface' in row).toBe(false)
})

test('a pool surface parses, planar or sky, with an optional resolution', (): void => {
  expect(surfaceOf(pool({ surface }))).toEqual(surface)
  expect(
    surfaceOf(
      pool({ surface: { ...surface, reflect: 'sky', resolution: 512 } }),
    )?.resolution,
  ).toBe(512)
})

test('a bad pool surface is refused', (): void => {
  refuse({ reflect: 'mirror' })
  refuse({ tint: [2, 0, 0] })
  refuse({ resolution: 64 })
  refuse({ extra: 1 })
})
