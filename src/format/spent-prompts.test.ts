import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { TargetsSchema, targetRules } from './targets.ts'

// TE-ENG6: a use target names the condition that spends it (`unless`, a hooks.conditions row), and a kit.lever's take
// projects to a player field (`itemFields` property `taken`) a panel can follow. Only the fields the rules read are built.
type Shard = Parameters<typeof targetRules>[1]
type Targets = Parameters<typeof targetRules>[0]
function shard(family: string, type = 'bool'): Shard {
  const rows = {
    state: {
      shared: [],
      player: [{ id: 301, name: 'rack.taken', type, privacy: 'owner' }],
    },
    hooks: {
      conditions: [
        { id: 'brazier.lit', scope: 'shared', fieldId: 102, equals: 1 },
        { id: 'rack.taken', scope: 'player', fieldId: 301, equals: 1 },
        { id: 'secret', scope: 'player', fieldId: 302, equals: 1 },
      ],
      scenes: [{ id: 'rack.take' }, { id: 'brazier.light' }],
    },
    sim: { scripts: ['main'], bindings: [] },
    items: { rows: [{ id: 'weapon.rifle', kind: 'weapon', family }] },
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The rules read only these fields of a whole shard.
  return rows as unknown as Shard
}
// oxlint-disable-next-line unicorn/no-null -- The rule's props argument is null when a shard has no props.
const noProps = null
const use = {
  id: 'brazier.use',
  at: [0, 1, 0],
  radius: 2.5,
  label: 'Light brazier A',
  scene: 'brazier.light',
}
function targets(unless: string, property = 'taken'): Targets {
  const rows = {
    panels: [],
    interactions: [unless === '' ? use : { ...use, unless }],
    itemActions: [{ scene: 'rack.take', item: 'weapon.rifle', action: 3 }],
    itemFields: [{ item: 'weapon.rifle', fieldId: 301, property }],
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The rows as the schema admits them.
  return rows as unknown as Targets
}

test('a use target may name the condition that spends it', (): void => {
  expect(safeParse(TargetsSchema, targets('brazier.lit')).success).toBe(true)
  expect(
    targetRules(targets('brazier.lit'), shard('kit.lever'), noProps),
  ).toEqual([])
  expect(targetRules(targets('nobody'), shard('kit.lever'), noProps)).toContain(
    'declared target interaction conditions',
  )
})
test('a kit.lever take projects to a bool player field; nothing else does', (): void => {
  expect(targetRules(targets(''), shard('kit.lever'), noProps)).toEqual([])
  expect(targetRules(targets(''), shard('kit.melee'), noProps)).toContain(
    'declared item state projections',
  )
  expect(
    targetRules(targets(''), shard('kit.lever', 'f64'), noProps),
  ).toContain('declared item state projections')
  expect(
    targetRules(targets('', 'fuel'), shard('kit.lever', 'f64'), noProps),
  ).toContain('declared item state projections')
})

test('a player condition spends a use only through a projected field', (): void => {
  const refused = 'declared target interaction conditions'
  expect(
    targetRules(targets('rack.taken'), shard('kit.lever'), noProps),
  ).not.toContain(refused)
  expect(targetRules(targets('secret'), shard('kit.lever'), noProps)).toContain(
    refused,
  )
})
test('a panel on a projected player field is drawn only, with no collider', (): void => {
  const refused = 'declared item projection colliders'
  const panel = {
    panel: 'rack.rifle',
    scope: 'player',
    fieldId: 301,
    equals: 1,
    visibleWhenMatched: false,
    activeWhenMatched: false,
  }
  const withPanel = (colliders: readonly string[]): Targets =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The rows as the schema admits them.
    ({
      ...targets(''),
      panels: [{ ...panel, colliders }],
    }) as unknown as Targets

  expect(targetRules(withPanel([]), shard('kit.lever'), noProps)).not.toContain(
    refused,
  )
  expect(
    targetRules(withPanel(['rack.rifle']), shard('kit.lever'), noProps),
  ).toContain(refused)
})
