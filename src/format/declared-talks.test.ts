import { expect, test } from 'vitest'

import { targetRules } from './targets.ts'

// TE-ENG3: a talk names a declared dialogue tree and, optionally, a props figure. Only the fields the rule reads are built here.
type Shard = Parameters<typeof targetRules>[1]
type Targets = Parameters<typeof targetRules>[0]
function targets(talk: Readonly<Record<string, unknown>>): Targets {
  const rows = {
    panels: [],
    interactions: [{ id: 'door.use', scene: 'door.toggle' }],
    talks: [
      {
        id: 'keeper.talk',
        at: [0, 0, 0],
        radius: 2,
        label: 'Talk',
        dialogue: 'keeper',
        ...talk,
      },
    ],
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The rule reads only the talk and interaction rows here.
  return rows as unknown as Targets
}
const shardRows = {
  state: { shared: [], player: [] },
  hooks: { scenes: [{ id: 'door.toggle' }] },
  sim: { scripts: [], bindings: [] },
  items: { rows: [] },
  quests: { dialogue: [{ id: 'keeper' }] },
}
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The rule reads only these fields of a whole shard.
const shard = shardRows as unknown as Shard
const props = { panels: [], colliders: [], models: [{ id: 'keeper.figure' }] }
const refused = 'declared talk dialogues and figures'

test('a talk may speak a declared tree, with or without a props figure', (): void => {
  expect(targetRules(targets({}), shard, props)).not.toContain(refused)
  expect(
    targetRules(targets({ figure: 'keeper.figure' }), shard, props),
  ).not.toContain(refused)
})
test('a talk refuses an unknown tree, an unknown figure and an id an interaction holds', (): void => {
  expect(targetRules(targets({ dialogue: 'nobody' }), shard, props)).toContain(
    refused,
  )
  expect(targetRules(targets({ figure: 'ghost' }), shard, props)).toContain(
    refused,
  )
  expect(targetRules(targets({ id: 'door.use' }), shard, props)).toContain(
    refused,
  )
})
