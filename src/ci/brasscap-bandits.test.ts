import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import {
  array,
  boolean,
  nullable,
  number,
  object,
  optional,
  parse,
  string,
} from 'valibot'

import { ROOT } from '../test/helpers/corpus.ts'

// BM-4 (meta TEMPLATE-E2E-PLAN): three camps of tin bandits on pursue brains.
// Each camp is a step of BM-6's `brasscap.mesa` quest. The gate is its own
// untracked quest: clearing all three camps completes it, its hook scene
// sets the gate's shared field, and the gate panel's collider drops on it.

const BRASSCAP = path.join(ROOT, 'corpus/exports/brasscap-mesa')
/** The canyon GLB's camp empties at the pinned commit (shard-brasscap tools/canyon.ts). */
const CAMPS: readonly (readonly [string, readonly [number, number, number]])[] =
  [
    ['camp.1', [-14, 0, -28]],
    ['camp.2', [13.5, 6, -34]],
    ['camp.3', [18.4, 0, -50.5]],
  ]
const BANDIT = 'brasscap.bandit'
const SkinFileSchema = object({ row: object({ id: string(), file: string() }) })
const PER_CAMP = 3
/** How far a bandit may stand from its camp's empty. LF2-2's side canyon puts
 *  camp 3's first bandit 6.4 m from `camp.3`, up the slot toward the gate. */
const CAMP_REACH = 7
const GATE_FIELD = 101

const Num = number()
const Str = string()
const Strs = array(Str)
// The Wyrm (BM-5) stands brainless: its encounter owns it.
const Spawn = object({
  id: Str,
  species: Str,
  brain: nullable(Str),
  at: array(Num),
})
const Brain = object({ id: Str, kind: Str })
const CreaturesSchema = object({
  creatures: object({ brains: array(Brain), spawns: array(Spawn) }),
})
const Condition = object({ all: optional(Strs) })
const Step = object({ id: Str, done: Condition })
const Complete = object({ scene: optional(Str) })
const Quest = object({
  id: Str,
  completeFlag: Str,
  steps: array(Step),
  onComplete: optional(Complete),
})
const QuestsSchema = object({
  quests: object({ quests: array(Quest) }),
})
const Scene = object({ id: Str })
const HooksSchema = object({ hooks: object({ scenes: array(Scene) }) })
const Field = object({ id: Num, privacy: Str })
const StateSchema = object({ state: object({ shared: array(Field) }) })
const Panel = object({
  panel: Str,
  fieldId: Num,
  colliders: Strs,
  activeWhenMatched: boolean(),
})
const UiSchema = object({ targets: object({ panels: array(Panel) }) })
const CollisionPanel = object({ id: Str, panel: Str })
const CollisionSchema = object({
  meshCollision: object({ panels: array(CollisionPanel) }),
})
const SkinParameters = object({ skin: optional(Str) })
const Look = object({ species: Str, recipe: Str, parameters: SkinParameters })
const LooksSchema = object({ rows: object({ looks: array(Look) }) })
const SimSchema = object({ sim: object({ scripts: Strs }) })
const IndexSchema = object({ admission: object({ library: Strs }) })

type Row = Readonly<{ id: string }>
type Placed = Readonly<{
  id: string
  species: string
  brain: string | null
  at: readonly number[]
}>

const MESA = 'brasscap.mesa'
const GATE_FLAG = 'brasscap.gate.open'

function section(file: string): unknown {
  return JSON.parse(readFileSync(path.join(BRASSCAP, file), 'utf8'))
}

type QuestRow = Readonly<{
  id: string
  completeFlag: string
  steps: readonly QuestStep[]
  onComplete?: Readonly<{ scene?: string | undefined }> | undefined
}>
type QuestStep = Readonly<{
  id: string
  done: Readonly<{ all?: readonly string[] | undefined }>
}>

/** The quest row with this id, or the one raising this completion flag. */
function quest(match: (row: QuestRow) => boolean): QuestRow {
  const { quests } = parse(QuestsSchema, section('sections/quests/quests.json'))
  const row = quests.quests.find(match)
  assert.ok(row, 'the quest row')
  return row
}

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function bandits(): readonly Placed[] {
  const file = section('sections/actors/creatures.json')
  return parse(CreaturesSchema, file).creatures.spawns.filter(
    (row: Placed): boolean => row.species === BANDIT,
  )
}

function brainKind(id: string | null): string | undefined {
  const file = section('sections/actors/creatures.json')
  const { brains } = parse(CreaturesSchema, file).creatures
  return brains.find((row: Row): boolean => row.id === id)?.kind
}

function gatePanel(): Readonly<{
  panel: string
  colliders: readonly string[]
  activeWhenMatched: boolean
}> {
  const { targets } = parse(UiSchema, section('sections/ui/ui.json'))
  const gate = targets.panels.find(
    (row: Readonly<{ fieldId: number }>): boolean => row.fieldId === GATE_FIELD,
  )
  assert.ok(gate, 'a target panel on the gate field')
  return gate
}

test('BM-4: three bandits on pursue brains stand at each camp empty', (): void => {
  const rows = bandits()
  assert.equal(rows.length, CAMPS.length * PER_CAMP)
  for (const [name, [campX, , campZ]] of CAMPS) {
    const near = rows.filter(
      (row: Placed): boolean =>
        Math.hypot((row.at[0] ?? 0) - campX, (row.at[2] ?? 0) - campZ) <=
        CAMP_REACH,
    )
    assert.equal(near.length, PER_CAMP, name)
  }
  for (const row of rows) {
    assert.equal(brainKind(row.brain), 'pursue')
  }
})

/** The skin a `platform.skin` look draws the bandit with. */
function banditSkin(): string | undefined {
  const { rows } = parse(LooksSchema, section('sections/look/materials.json'))
  const look = rows.looks.find(
    (row: Readonly<{ species: string }>): boolean => row.species === BANDIT,
  )
  assert.equal(look?.recipe, 'platform.skin')
  return look.parameters.skin
}

test('BM-4: the bandit draws as its generated skin', (): void => {
  const skin = banditSkin() ?? ''
  const skinPath = path.join(BRASSCAP, 'blobs/json', `${skin}.json`)
  const { row } = parse(
    SkinFileSchema,
    JSON.parse(readFileSync(skinPath, 'utf8')),
  )
  assert.equal(row.id, BANDIT)
  const glb = row.file
  const glbBytes = readFileSync(path.join(BRASSCAP, 'blobs/glb', `${glb}.glb`))
  assert.equal(sha256(glbBytes), glb)
  const { library } = parse(IndexSchema, section('shard.json')).admission
  assert.ok(library.includes(glb) && library.includes(skin))
})

/** The spawn ids of the bandits standing at a camp. */
function campBodies(campX: number, campZ: number): readonly string[] {
  return bandits()
    .filter(
      (row: Placed): boolean =>
        Math.hypot((row.at[0] ?? 0) - campX, (row.at[2] ?? 0) - campZ) <=
        CAMP_REACH,
    )
    .map((row: Placed): string => row.id)
}

// Engine raises `dead:<spawn id>` at each death, so a step names its own
// camp's bodies: killing camp 3 first cannot clear camp 1.
test('BM-4: each camp is a step, done when its own bandits are down', (): void => {
  const steps = quest((row: QuestRow): boolean => row.id === MESA).steps.filter(
    (row: Row): boolean => row.id.startsWith('camp-'),
  )
  assert.equal(steps.length, CAMPS.length)
  for (const [at, [name, [campX, , campZ]]] of CAMPS.entries()) {
    const dead = campBodies(campX, campZ).map(
      (id: string): string => `dead:${id}`,
    )
    assert.deepEqual(steps[at]?.done.all, dead, name)
  }
})

test('BM-4: the gate opens once all three camps are down', (): void => {
  const gate = quest((row: QuestRow): boolean => row.completeFlag === GATE_FLAG)
  const dead = bandits().map((row: Placed): string => `dead:${row.id}`)
  assert.deepEqual(
    gate.steps.flatMap(
      (row: QuestStep): readonly string[] => row.done.all ?? [],
    ),
    dead,
  )
})

test('BM-4: the gate quest sets the gate field through its hook script', (): void => {
  const gate = quest((row: QuestRow): boolean => row.completeFlag === GATE_FLAG)
  const scene = gate.onComplete?.scene
  const { hooks } = parse(HooksSchema, section('sections/sim/hooks.json'))
  assert.ok(hooks.scenes.some((row: Row): boolean => row.id === scene))
  const { state } = parse(StateSchema, section('sections/state/state.json'))
  const field = state.shared.find(
    (row: Readonly<{ id: number }>): boolean => row.id === GATE_FIELD,
  )
  assert.equal(field?.privacy, 'public')
  const { sim } = parse(SimSchema, section('sections/sim/sim.json'))
  const [script = ''] = sim.scripts
  assert.ok(existsSync(path.join(BRASSCAP, `blobs/wasm/${script}.wasm`)))
})

test('BM-4: the gate panel drops the baked gate door collider', (): void => {
  const gate = gatePanel()
  assert.equal(gate.activeWhenMatched, false, 'the collider drops when open')
  const file = section('sections/world/collision.json')
  const { panels } = parse(CollisionSchema, file).meshCollision
  for (const id of gate.colliders) {
    const baked = panels.find((row: Row): boolean => row.id === id)
    assert.equal(baked?.panel, gate.panel, `${id} is the gate door's collider`)
  }
})
