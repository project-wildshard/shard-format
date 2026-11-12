import { expect, test } from 'vitest'

import { targetRules } from './targets.ts'

// TE-ENG2: an item scene may name a declared lever-action (`kit.lever`), so a rack's prompt takes the rifle.
// Any other weapon is still refused. Only the fields the rule reads are built here.
type Shard = Parameters<typeof targetRules>[1]
type Targets = Parameters<typeof targetRules>[0]
function shard(family: string): Shard {
  const rows = {
    state: { shared: [], player: [] },
    hooks: { scenes: [{ id: 'rack.take' }] },
    sim: { scripts: [], bindings: [] },
    items: { rows: [{ id: 'weapon.rifle', kind: 'weapon', family }] },
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The rule reads only these fields of a whole shard.
  return rows as unknown as Shard
}
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The rule reads only the item action rows here.
const targets = {
  panels: [],
  interactions: [],
  itemActions: [{ scene: 'rack.take', item: 'weapon.rifle', action: 3 }],
} as unknown as Targets

test('an item scene may take a kit.lever weapon', (): void => {
  // oxlint-disable-next-line unicorn/no-null -- The rule's props argument is null when a shard has no props.
  expect(targetRules(targets, shard('kit.lever'), null)).not.toContain(
    'declared item action scenes',
  )
})
test('an item scene still refuses any other weapon', (): void => {
  // oxlint-disable-next-line unicorn/no-null -- The rule's props argument is null when a shard has no props.
  expect(targetRules(targets, shard('kit.melee'), null)).toContain(
    'declared item action scenes',
  )
})
