import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { array, boolean, number, object, parse, string } from 'valibot'

import { ROOT } from '../test/helpers/corpus.ts'

// TE-ENG6's Brasscap follow-up (meta TEMPLATE-E2E-PLAN): the rack's rifle
// hides once taken. It is a prop panel of its own, drawn only (no collider),
// following the player's bool field that the lever's `taken` projects, so
// each player sees the rack as their own take left it.

const BRASSCAP = path.join(ROOT, 'corpus/exports/brasscap-mesa')
const RIFLE_PANEL = 'brasscap.rack.rifle'

const Num = number()
const Str = string()
const Panel = object({
  panel: Str,
  scope: Str,
  fieldId: Num,
  equals: Num,
  visibleWhenMatched: boolean(),
  colliders: array(Str),
})
const ItemField = object({ item: Str, fieldId: Num, property: Str })
const RackTargets = object({
  panels: array(Panel),
  itemFields: array(ItemField),
})
const UiSchema = object({ targets: RackTargets })
const Item = object({ id: Str, family: Str })
const ItemsSchema = object({ items: object({ rows: array(Item) }) })
const Named = object({ id: Str })
const PropsSchema = object({ props: object({ panels: array(Named) }) })
const CollisionPanel = object({ panel: Str })
const Collision = object({ panels: array(CollisionPanel) })
const CollisionSchema = object({ meshCollision: Collision })
const Field = object({ id: Num, type: Str, privacy: Str })
const StateSchema = object({ state: object({ player: array(Field) }) })

function section(file: string): unknown {
  return JSON.parse(readFileSync(path.join(BRASSCAP, 'sections', file), 'utf8'))
}

/** The rack rifle's target panel row. */
function rifleTarget(): Readonly<{
  panel:
    | Readonly<{
        fieldId: number
        scope: string
        equals: number
        visibleWhenMatched: boolean
        colliders: readonly string[]
      }>
    | undefined
  itemFields: readonly Readonly<{
    item: string
    fieldId: number
    property: string
  }>[]
}> {
  const { targets } = parse(UiSchema, section('ui/ui.json'))
  const panel = targets.panels.find(
    (row: Readonly<{ panel: string }>): boolean => row.panel === RIFLE_PANEL,
  )
  return { panel, itemFields: targets.itemFields }
}

test("the rack's rifle panel shows until its player's field reads 1", (): void => {
  const { panel } = rifleTarget()
  assert.ok(panel, 'a target panel for the rack rifle')
  assert.equal(panel.scope, 'player')
  assert.equal(panel.equals, 1)
  assert.equal(panel.visibleWhenMatched, false)
  assert.deepEqual(panel.colliders, [])
})

test("that field is the lever's `taken`, a bool player field", (): void => {
  const { panel, itemFields } = rifleTarget()
  const { items } = parse(ItemsSchema, section('combat/items.json'))
  const lever = items.rows.find(
    (row: Readonly<{ family: string }>): boolean => row.family === 'kit.lever',
  )
  const fieldId = panel?.fieldId
  assert.deepEqual(
    itemFields.find(
      (row: Readonly<{ fieldId: number }>): boolean => row.fieldId === fieldId,
    ),
    { item: lever?.id, fieldId, property: 'taken' },
  )
  const { state } = parse(StateSchema, section('state/state.json'))
  const field = state.player.find(
    (row: Readonly<{ id: number }>): boolean => row.id === fieldId,
  )
  assert.deepEqual([field?.type, field?.privacy], ['bool', 'owner'])
})

// SS4: shard-brasscap 3475153 bakes the rifle panel a collider. The old corpus rebake filtered it out after the cook;
// the sdk's `world.interactive` row needs a `colliderId`, so the source cannot say "drawn only" yet. Todo until it can.
test(
  "the rack's rifle is baked as a prop panel with no collider",
  {
    todo: 'shard-brasscap: a drawn-only interactive panel (sdk world.interactive without colliderId)',
  },
  (): void => {
    const { props } = parse(PropsSchema, section('world/props.json'))
    assert.ok(
      props.panels.some(
        (row: Readonly<{ id: string }>): boolean => row.id === RIFLE_PANEL,
      ),
      'a prop panel',
    )
    const { meshCollision } = parse(
      CollisionSchema,
      section('world/collision.json'),
    )
    assert.ok(
      !meshCollision.panels.some(
        (row: Readonly<{ panel: string }>): boolean =>
          row.panel === RIFLE_PANEL,
      ),
      'no collider',
    )
  },
)
