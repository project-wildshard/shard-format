// ONE-FORMAT OF19b0/OF19c0: a data page's runtime plan keeper runs beside declared spawns, their species and encounters
// (the engine refuses a body both own), so the page rules admit them; declared crowds stay refused, and a quest may name
// a declared spawn.
import { expect, test } from 'vitest'

import { clientOwnershipRules } from './clientOwnership.ts'

import type { Shardfile } from './shardSchema.ts'

/** The fixture is the page fields the rules read, nothing more. */
function fields(value: unknown): value is Shardfile {
  return typeof value === 'object' && value !== null && 'questHost' in value
}
/** Only the fields the page rules read: a versioned quest page, no runtime, these spawns and crowds. */
function page(spawns: string, crowds: string): Shardfile {
  const source: unknown = JSON.parse(
    `{"runtime":null,"questHost":{"page":{"version":1,"quest":"q"},"actors":{"ids":[]}},"quests":{"quests":[]},` +
      `"questNpcs":[],"items":{"loadout":{"primary":null,"secondary":null,"tools":[]},"rows":[]},"rows":{"species":[]},"encounters":[],` +
      `"creatures":{"spawns":[${spawns}]},"crowds":[${crowds}]}`,
  )
  if (!fields(source)) {
    throw new Error('Unreadable page fixture')
  }
  return source
}

test('a data page admits declared spawns beside its plan, and still refuses declared crowds', (): void => {
  const spawned = clientOwnershipRules(page('{"id":"ray"}', ''), new Map())
  expect(spawned.some((error): boolean => error.includes('roster'))).toBe(false)
  expect(clientOwnershipRules(page('', '{"id":"flock"}'), new Map())).toContain(
    'Data page native roster cannot also install declared crowds',
  )
})
