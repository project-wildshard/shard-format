import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { outputFixture } from '../test/helpers/output-fixture.ts'
import { ShardfileFieldSchemas, shardfileRules } from './shardSchema.ts'

import type { Shardfile } from './shardSchema.ts'

const nothing: unknown = JSON.parse('null')
const look = (light: object): object => ({
  families: ['pbr'],
  clock: 'engine',
  dayOverride: nothing,
  keys: [],
  light,
  grade: { exposure: 0, saturation: 1, contrast: 1, lut: nothing },
})
const read = (
  input: object,
): ReturnType<typeof parse<typeof ShardfileFieldSchemas.look>> =>
  parse(ShardfileFieldSchemas.look, input)

// Meta SHARD-SOURCE SS8b: hanging bodies, and the lamps that swing with them.
const swing = {
  pivot: [1, 3, 2],
  length: 0.8,
  rate: 0.6,
  amount: 0.12,
  reach: 0.5,
}
const lamp = {
  at: [1, 2.2, 2],
  colour: [1, 0.6, 0.3],
  intensity: 3,
  distance: 6,
}

test('swings parse, and a lamp names the swing it hangs from', (): void => {
  const { light } = read(
    look({ swings: [swing], lamps: [{ ...lamp, swing: 0 }, lamp] }),
  )
  expect(light?.swings).toEqual([swing])
  expect(light?.lamps?.[0]?.swing).toBe(0)
  expect('swing' in (light?.lamps?.[1] ?? {})).toBe(false)
})

test('a lamp on an undeclared swing and bad swings are refused', (): void => {
  for (const bad of [
    { lamps: [{ ...lamp, swing: 0 }] },
    { swings: [swing], lamps: [{ ...lamp, swing: 1 }] },
    { swings: [swing], lamps: [{ ...lamp, swing: 0.5 }] },
    { swings: [] },
    { swings: [{ ...swing, length: 0 }] },
    { swings: [{ ...swing, amount: 1 }] },
    { swings: [{ ...swing, reach: -1 }] },
    { swings: Array.from({ length: 33 }, (): object => swing) },
  ]) {
    expect((): object => read(look(bad))).toThrow()
  }
})

// Meta MOSSGATE-ZONE MZ34: a lamp that shows and hides with a props panel (a brazier's fire lights with its flames).
test('a lamp names the panel it shows and hides with', (): void => {
  const { light } = read(
    look({ lamps: [{ ...lamp, panel: 'mossgate.flame-a' }, lamp] }),
  )
  expect(light?.lamps?.[0]?.panel).toBe('mossgate.flame-a')
  expect('panel' in (light?.lamps?.[1] ?? {})).toBe(false)
  expect((): unknown =>
    read(look({ lamps: [{ ...lamp, panel: '' }] })),
  ).toThrow()
})

test("a lamp's panel must be a declared props panel", (): void => {
  const shard = outputFixture()
  const lit = (panel: string): Shardfile => ({
    ...shard,
    look: {
      ...shard.look,
      light: {
        ...shard.look.light,
        lamps: [{ ...lamp, at: [1, 2, 3], colour: [1, 0.6, 0.3], panel }],
      },
    },
  })
  expect(shardfileRules(lit('no.such.panel'))).toContain(
    'look lamp names panel no.such.panel, which props.panels does not declare',
  )
})
