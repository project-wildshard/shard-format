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

// Meta TEMPLATES-CLEANROOM B2: what Brasscap's cleanroom needs and look.json could not say: real lamps, a warm bounce,
// sky-derived ambient and the Neutral display curve. Each absent is off, as before.

test('lamps, bounce and environment each parse on their own', (): void => {
  const lamp = {
    at: [1, 2, -3],
    colour: [1, 0.4, 0.06],
    intensity: 4,
    distance: 7,
  }
  expect(read(look({ light: { lamps: [lamp] } })).light?.lamps).toEqual([lamp])
  expect(
    read(
      look({
        light: {
          bounce: { colour: [1, 0.28, 0.16], intensity: 0.35, lift: 0.25 },
        },
      }),
    ).light?.bounce?.lift,
  ).toBe(0.25)
  expect(
    read(
      look({
        light: { environment: { intensity: 0.5, ground: [1, 0.25, 0.1] } },
      }),
    ).light?.environment?.intensity,
  ).toBe(0.5)
})

test('grade.tone picks agx or neutral, and is absent by default', (): void => {
  expect(read(look({}, { tone: 'neutral' })).grade.tone).toBe('neutral')
  expect(read(look({}, { tone: 'agx' })).grade.tone).toBe('agx')
  expect('tone' in read(look()).grade).toBe(false)
})

test('out-of-range lamps, bounce, environment or tone are refused', (): void => {
  const lamp = { at: [0, 1, 0], colour: [1, 1, 1], intensity: 4, distance: 7 }
  expect((): unknown => read(look({ light: { lamps: [] } }))).toThrow()
  expect((): unknown =>
    read(
      look({
        light: { lamps: Array.from({ length: 17 }, (): object => lamp) },
      }),
    ),
  ).toThrow()
  expect((): unknown =>
    read(look({ light: { lamps: [{ ...lamp, distance: 0 }] } })),
  ).toThrow()
  expect((): unknown =>
    read(look({ light: { lamps: [{ ...lamp, shadow: true }] } })),
  ).toThrow()
  expect((): unknown =>
    read(
      look({ light: { bounce: { colour: [1, 1, 1], intensity: 1, lift: 2 } } }),
    ),
  ).toThrow()
  expect((): unknown =>
    read(look({ light: { environment: { intensity: 9, ground: [0, 0, 0] } } })),
  ).toThrow()
  expect((): unknown => read(look({}, { tone: 'aces' }))).toThrow()
})
