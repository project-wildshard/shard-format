import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { ShardfileFieldSchemas } from './shardSchema.ts'

// Meta TEMPLATE-E2E LF1-4: optional light and post settings on look.json (contact AO, a warm rim, height fog, light
// pools) and look.grade.bloom. Each is off when absent and no default is filled, so an old product keeps its bytes.

const nothing: unknown = JSON.parse('null')

const look = (extra: object = {}, grade: object = {}): object => ({
  families: ['pbr'],
  clock: 'engine',
  dayOverride: nothing,
  keys: [],
  ...extra,
  grade: { exposure: 0, saturation: 1, contrast: 1, lut: nothing, ...grade },
})
const read = (
  input: object,
): ReturnType<typeof parse<typeof ShardfileFieldSchemas.look>> =>
  parse(ShardfileFieldSchemas.look, input)

test('a look without light settings parses with no light or bloom key', (): void => {
  const parsed = read(look())
  expect('light' in parsed).toBe(false)
  expect('bloom' in parsed.grade).toBe(false)
})

test('each light setting parses on its own', (): void => {
  expect(
    read(look({ light: { ao: { intensity: 2, radius: 1.5 } } })).light?.ao,
  ).toEqual({ intensity: 2, radius: 1.5 })
  expect(
    read(
      look({
        light: { rim: { colour: [1, 0.7, 0.4], strength: 0.4, power: 3 } },
      }),
    ).light?.rim?.power,
  ).toBe(3)
  expect(
    read(
      look({
        light: { heightFog: { density: 0.08, height: -1, falloff: 0.6 } },
      }),
    ).light?.heightFog?.height,
  ).toBe(-1)
  expect(
    read(
      look({
        light: {
          pools: {
            colour: [1, 0.6, 0.2],
            intensity: 1,
            radius: 3,
            at: [[0, 0, -9]],
          },
        },
      }),
    ).light?.pools?.at,
  ).toEqual([[0, 0, -9]])
})

test('grade.bloom is declarable', (): void => {
  expect(
    read(look({}, { bloom: { intensity: 0.8, threshold: 0.7 } })).grade.bloom,
  ).toEqual({ intensity: 0.8, threshold: 0.7 })
})

test('out-of-range or unknown light settings are refused', (): void => {
  expect((): unknown =>
    read(
      look({ light: { rim: { colour: [1, 1, 1], strength: 5, power: 3 } } }),
    ),
  ).toThrow()
  expect((): unknown =>
    read(
      look({
        light: {
          pools: { colour: [1, 1, 1], intensity: 1, radius: 1, at: [] },
        },
      }),
    ),
  ).toThrow()
  expect((): unknown => read(look({ light: { sparkle: true } }))).toThrow()
  expect((): unknown => read(look({}, { bloom: { intensity: 1 } }))).toThrow()
})
