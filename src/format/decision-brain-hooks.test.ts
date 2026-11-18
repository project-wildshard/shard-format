import { safeParse } from 'valibot'
import { expect, it } from 'vitest'

import { DecisionScriptsSchema } from './decisionScripts.ts'
import { SCRIPT_V1_COMMANDS, SCRIPT_V1_EVENTS } from './scriptAbiV1.ts'

// ONE-FORMAT CC59: a script hooks a brain-owned creature (`brain` binding), hears its broken parts, reads the last
// hit's tags as a mask and may replace the brain's next ability.

type Json = Record<string, unknown>

function hook(changes: Readonly<Json> = {}): Json {
  return {
    abi: '1.0',
    actors: { self: 'troll' },
    binding: { brain: 'troll' },
    commands: ['ability', 'heal'],
    id: 'troll.hook',
    module: `blobs/wasm/${'a'.repeat(64)}.wasm`,
    on: ['hit', 'part.broken'],
    onFail: 'hold',
    params: {},
    reads: [],
    side: 'sim',
    source: 'behaviour/troll.as',
    state: [],
    stateVersion: 1,
    tags: { fire: 'dmg.fire' },
    ...changes,
  }
}

function admitted(changes: Readonly<Json>): boolean {
  return safeParse(DecisionScriptsSchema, [hook(changes)]).success
}

it('keeps the brain-hook wire ids', (): void => {
  expect(SCRIPT_V1_EVENTS['part.broken']).toBe(19)
  expect(SCRIPT_V1_COMMANDS.ability).toBe(27)
})

it('admits a brain hook that names its creature and leaves the body to the brain', (): void => {
  expect(admitted({})).toBe(true)
  expect(admitted({ actors: { other: 'ogre' } })).toBe(false)
  expect(admitted({ commands: ['ability', 'move'] })).toBe(false)
  expect(admitted({ commands: ['ability', 'strike'] })).toBe(false)
  expect(admitted({ commands: ['ability', 'stop'] })).toBe(false)
})

it('bounds the hit tags a hook reads', (): void => {
  expect(admitted({ tags: { fire: 'fire' } })).toBe(false)
  const many: Json = {}
  for (let index = 0; index < 17; index += 1) {
    many[`t${String(index)}`] = `dmg.t${String(index)}`
  }
  expect(admitted({ tags: many })).toBe(false)
})
