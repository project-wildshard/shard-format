// ONE-FORMAT OF19d1: a look row can name a scene model library's rig (`platform.rig`). FORMAT-PRUNE FP20: a data page
// draws its declared bodies from their looks, and its plan keeper stands none (the species program is deleted).
import { expect, test } from 'vitest'

import { clientOwnershipRules } from './clientOwnership.ts'
import {
  RIG_LOOK_RECIPE,
  rigLookParameters,
  rigLookRules,
} from './rig-looks.ts'

import type { RigLookRow } from './rig-looks.ts'
import type { Shardfile } from './shardSchema.ts'

const LOOKS = 'Data page draws its creatures from their declared looks'
const LIBRARY = 'Rig look look.ray names no world/scenes models library'
const SCENES = {
  libraries: [{ file: 'models.json', id: 'models', kind: 'models' }],
}
const PLAIN =
  '{"id":"look.ray","species":"ray","recipe":"platform.rig","material":null,"parameters":{"library":"models"},' +
  '"animation":{"recipe":"platform.rig","parameters":{}}}'

/** Whether a parsed fixture is a look row. */
function isLook(value: unknown): value is RigLookRow {
  return value instanceof Object && 'recipe' in value
}
/** The plain rig look, with `fields` over it. */
function look(fields: Readonly<Record<string, unknown>> = {}): RigLookRow {
  const plain: unknown = JSON.parse(PLAIN)
  if (!isLook(plain)) {
    throw new Error('Unreadable look fixture')
  }
  const row: unknown = { ...plain, ...fields }
  if (!isLook(row)) {
    throw new Error('Unreadable look fixture')
  }
  return row
}
/** The rig rules of one look beside a `world/scenes` with a models library. */
function errors(row: Readonly<RigLookRow>): readonly string[] {
  return rigLookRules([row], new Map([['world/scenes', SCENES]]))
}

test('a rig look names its library and, optionally, its body', (): void => {
  expect(RIG_LOOK_RECIPE).toBe('platform.rig')
  expect(errors(look())).toEqual([])
  const named = look({ parameters: { body: 'duneRay', library: 'models' } })
  expect(errors(named)).toEqual([])
  expect(rigLookParameters(named)).toEqual({
    body: 'duneRay',
    library: 'models',
  })
})

test('a rig look refuses a material, other parameters, or clips of its own', (): void => {
  const parameters =
    'Rig look parameters are a library and an optional body: look.ray'
  const clips = "A rig look plays its rig's own clips: look.ray"
  expect(errors(look({ parameters: {} }))).toContain(parameters)
  expect(errors(look({ parameters: { library: 'models', tint: 1 } }))).toEqual([
    parameters,
  ])
  expect(errors(look({ material: 'sand' }))).toEqual([
    "A rig look draws with its rig's surfaces: look.ray",
  ])
  expect(
    errors(look({ animation: { parameters: {}, recipe: 'kit.pose' } })),
  ).toEqual([clips])
  expect(
    errors(
      look({
        animation: { parameters: { speed: 2 }, recipe: RIG_LOOK_RECIPE },
      }),
    ),
  ).toEqual([clips])
  expect(errors(look({ parameters: {}, recipe: 'engine.sphere' }))).toEqual([
    'Rig clips without a rig look: look.ray',
  ])
})

test("a rig look's library is a world/scenes models library", (): void => {
  const baked = {
    libraries: [{ file: 'baked.json', id: 'models', kind: 'baked' }],
  }
  expect(rigLookRules([look()], new Map([['world/scenes', baked]]))).toEqual([
    LIBRARY,
  ])
  expect(rigLookRules([look()], new Map())).toEqual([LIBRARY])
  expect(errors(look({ parameters: { library: 'other' } }))).toEqual([LIBRARY])
})

/** Whether a parsed fixture has the page fields the rules read. */
function isPage(value: unknown): value is Shardfile {
  return value instanceof Object && 'questHost' in value
}
/** A versioned quest page with one declared `ray` spawn, its species looked when `looked`. */
function page(looked: boolean): Shardfile {
  const looks = looked ? `[${PLAIN}]` : '[]'
  const source: unknown = JSON.parse(
    '{"runtime":null,"questHost":{"page":{"version":1,"quest":"q"},"actors":{"ids":[]}},"quests":{"quests":[]},' +
      `"questNpcs":[],"items":{"loadout":{"primary":null,"secondary":null,"tools":[]},"rows":[]},"rows":{"species":[],"looks":${looks}},` +
      '"encounters":[],"creatures":{"spawns":[{"id":"ray.0","species":"ray"}]},"crowds":[]}',
  )
  if (!isPage(source)) {
    throw new Error('Unreadable page fixture')
  }
  return source
}
/** A plan whose keeper stands one home when `kept`, nothing otherwise. */
function plan(kept: boolean): unknown {
  const homes = kept
    ? '{"id":"strider.0","kind":"duneStrider","at":[0,0],"yaw":0,"respawn":0}'
    : ''
  return JSON.parse(
    '{"kind":"held-melee","baked":{},"recipe":{"terrain":"none","ground":{"size":64,"height":0},' +
      '"player":{"speed":5},"runtime":{"weapon":{"id":"whip"},"quest":{"spots":"metadata"}},"population":{"sources":"actors",' +
      '"seed":"identity","rows":{"program":{"species":[],"strikes":[]},"step":"homes",' +
      `"seed":1,"homes":[${homes}],"attackers":null,"think":"legacy","admission":"install"}}}}`,
  )
}
/** The ownership rules of the page beside its plan and scenes. */
function rules(looked: boolean, kept: boolean): readonly string[] {
  return clientOwnershipRules(
    page(looked),
    new Map<string, unknown>([
      ['sim/runtime-plan', plan(kept)],
      ['world/scenes', SCENES],
    ]),
  )
}

test('a page drawing every declared body from its looks passes', (): void => {
  expect(rules(true, false)).not.toContain(LOOKS)
  expect(rules(true, false)).not.toContain(LIBRARY)
})

test('FP20: a keeper body, or a declared body with no look, is refused', (): void => {
  expect(rules(true, true)).toContain(LOOKS)
  expect(rules(false, false)).toContain(LOOKS)
})

test('OF29e5: a data page need not name population.homes, which the engine stands', (): void => {
  expect(rules(true, false)).toContain('Data page requires quest.page')
  expect(rules(true, false)).not.toContain(
    'Data page requires population.homes',
  )
})
