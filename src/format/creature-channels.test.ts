// ONE-FORMAT CC28: a body's actor channels, bound looks and look swap.
import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { CreatureBodySchema } from './creature-layers.ts'
import { SCRIPT_V1_COMMANDS } from './scriptAbiV1.ts'

const body = {
  skeleton: 'quadruped',
  size: 'small',
  scale: 1,
  look: 'chameleon.green',
  channels: [{ name: 'jaw' }, { name: 'fade', initial: 1 }, { name: 'form' }],
  bind: {
    tint: { channel: 'jaw', colour: [1, 0.2, 0.1] },
    emissive: { channel: 'jaw', colour: [0, 0, 1] },
    opacity: 'fade',
  },
  swap: { channel: 'form', look: 'chameleon.wolf', at: 0.5 },
}

test('a body keeps its channels, bound looks and swap', (): void => {
  expect(parse(CreatureBodySchema, body)).toEqual(body)
})

test.each([
  [
    'five channels',
    {
      channels: ['a', 'b', 'c', 'd', 'e'].map(
        (name: string): { name: string } => ({ name }),
      ),
    },
  ],
  ['a duplicate channel', { channels: [{ name: 'jaw' }, { name: 'jaw' }] }],
  ['an initial above 1', { channels: [{ name: 'jaw', initial: 1.5 }] }],
  ['an undeclared bound channel', { bind: { opacity: 'glow' } }],
  ['an undeclared swap channel', { swap: { channel: 'glow', look: 'x' } }],
  [
    'a colour above 1',
    { bind: { tint: { channel: 'jaw', colour: [2, 0, 0] } } },
  ],
])('%s refuses', (_name: string, change: object): void => {
  expect((): unknown =>
    parse(CreatureBodySchema, { ...body, ...change }),
  ).toThrow()
})

test('the actor channel command is additive', (): void => {
  expect(SCRIPT_V1_COMMANDS.actorChannel).toBe(28)
})
