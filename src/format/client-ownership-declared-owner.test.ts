// ONE-FORMAT OF20c: a data page's plan may keep its owner row while its boss is a declared spawn with a declared boss
// encounter (Sky Reach's Storm Roc). The engine binds the row's flag, fact, purse and save to that encounter, and the page
// draws the boss from the encounter's declared `ui` panel, so the page needs no keeper boss feature. A keeper boss, or an
// owner row naming a spawn with no boss encounter, still needs its matching page feature.
import { expect, test } from 'vitest'

import { clientOwnershipRules } from './clientOwnership.ts'
import owner from './fixtures/declared-boss-owner.json' with { type: 'json' }

import type { Shardfile } from './shardSchema.ts'

const PATTERN = 'Data page requires its actual native encounter pattern'

/** The fixture is the page fields the rules read, nothing more. */
function fields(value: unknown): value is Shardfile {
  return value instanceof Object && 'questHost' in value
}
/** A versioned quest page with the declared `roc` spawn, and the boss encounter on it when `encounter`. */
function page(encounter: boolean): Shardfile {
  const encounters = encounter
    ? '{"id":"roc.fight","entity":"roc","kind":"boss"}'
    : ''
  const source: unknown = JSON.parse(
    `{"runtime":null,"questHost":{"page":{"version":1,"quest":"q"},"actors":{"ids":[]}},"quests":{"quests":[]},` +
      `"questNpcs":[],"items":{"loadout":{"primary":null,"secondary":null,"tools":[]},"rows":[]},"rows":{"species":[]},` +
      `"encounters":[${encounters}],"creatures":{"spawns":[{"id":"roc"}]},"crowds":[]}`,
  )
  if (!fields(source)) {
    throw new Error('Unreadable page fixture')
  }
  return source
}
/** A plan whose owner row names `roc`, its keeper standing `roc` when `kept` and nothing otherwise. */
function plan(kept: boolean): unknown {
  const homes = kept
    ? '{"id":"roc","kind":"roc","at":[0,0],"yaw":0,"respawn":0}'
    : ''
  const section: unknown = JSON.parse(
    '{"kind":"held-melee","baked":{},"recipe":{"terrain":"none","ground":{"size":64,"height":0},' +
      '"player":{"speed":5},"runtime":{"weapon":{"id":"fan"},"quest":{"spots":"metadata"}},"population":{"sources":"actors",' +
      `"seed":"identity","owner":${JSON.stringify(owner)},"rows":{"program":{"species":[],"strikes":[]},"step":"homes",` +
      `"seed":1,"homes":[${homes}],"attackers":null,"think":"legacy","admission":"install"}}}}`,
  )
  return section
}
function rules(kept: boolean, encounter: boolean): readonly string[] {
  return clientOwnershipRules(
    page(encounter),
    new Map<string, unknown>([['sim/runtime-plan', plan(kept)]]),
  )
}

test('an owner row naming a declared boss needs no page boss feature', (): void => {
  expect(rules(false, true)).not.toContain(PATTERN)
})

test('a keeper boss, or a declared spawn with no boss encounter, still needs its page boss feature', (): void => {
  expect(rules(true, true)).toContain(PATTERN)
  expect(rules(false, false)).toContain(PATTERN)
})
