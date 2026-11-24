import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import {
  array,
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

// ZONE-SNAPSHOTS ZS5 (J507): these BM rows test the current export, corpus/exports/brasscap-mesa.
const BRASSCAP = path.join(ROOT, 'corpus/exports/brasscap-mesa')
/** The canyon GLB's camp empties at the pinned commit (shard-brasscap tools/canyon.ts). */
const CAMPS: readonly (readonly [string, readonly [number, number, number]])[] =
  [
    ['camp.1', [-14, 0, -28]],
    ['camp.2', [13.5, 6, -34]],
    ['camp.3', [18.4, 0, -50.5]],
  ]
const BANDIT = 'brasscap.bandit'
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
const SimSchema = object({ sim: object({ scripts: Strs }) })

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

function bandits(): readonly Placed[] {
  const file = section('sections/actors/creatures.json')
  return parse(CreaturesSchema, file).creatures.spawns.filter(
    (row: Placed): boolean => row.species === BANDIT,
  )
}

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
