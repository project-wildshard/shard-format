import { expect, test } from 'vitest'

import { parseLightEmitters } from './lightEmitters.ts'

const row = (extra: Record<string, unknown>): unknown => ({
  version: 1,
  input: 'lights',
  clock: 'clock',
  rows: [
    {
      id: 'shrine',
      parent: 'scene',
      draws: [],
      light: { at: { point: 'scene', offset: [0, 4.6, -70] }, colour: 0x7fe8ff, gain: 18, distance: 22, decay: 2 },
      ...extra,
    },
  ],
})

test('FP49: an emitter may follow a declared scene scalar', (): void => {
  expect(parseLightEmitters(row({ field: 'glow' })).rows[0]?.field).toBe('glow')
  expect(parseLightEmitters(row({})).rows[0]?.field).toBeUndefined()
})

test('FP49: an emitter field is a handle id, never an expression', (): void => {
  for (const field of ['', 'Glow', 'glow()', 7]) {
    expect(() => parseLightEmitters(row({ field }))).toThrow()
  }
})
