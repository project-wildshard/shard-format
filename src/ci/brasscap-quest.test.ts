import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import {
  array,
  boolean,
  number,
  object,
  optional,
  parse,
  string,
} from 'valibot'

import { ROOT } from '../test/helpers/corpus.ts'

// BM-6 (meta TEMPLATE-E2E-PLAN): Brasscap Mesa's quest, with no NPC.
// `brasscap.mesa` starts on spawn and its chip leads: take the rifle, clear
// the three camps, beat the Dust Wyrm. The rifle step is done by any kill:
// the rack's lever-action is the only weapon, and its `taken` line is owned
// by the holder, not a flag a quest can read. Every step reads engine's
// `dead:<spawn id>` flags. Completion pays coins and files the
// `brasscap.mesa` ledger fact, which a ledger rule turns into an
// achievement. The gate keeps BM-4's hook as its own untracked quest.

const BRASSCAP = path.join(ROOT, 'corpus/exports/brasscap-mesa')
const MESA = 'brasscap.mesa'
const GATE_FLAG = 'brasscap.gate.open'
const WYRM = 'dead:dust-wyrm'

const Str = string()
const Strs = array(Str)
const Condition = object({ all: optional(Strs), any: optional(Strs) })
const Step = object({ id: Str, done: Condition })
const Complete = object({
  coins: optional(number()),
  fact: optional(Str),
  scene: optional(Str),
})
const Quest = object({
  id: Str,
  completeFlag: Str,
  startWhen: optional(Condition),
  track: optional(boolean()),
  steps: array(Step),
  onComplete: optional(Complete),
})
const QuestsSchema = object({
  quests: object({ flags: Strs, quests: array(Quest) }),
})
const Spawn = object({ id: Str, species: Str })
const CreaturesSchema = object({
  creatures: object({ spawns: array(Spawn) }),
})
const Reward = object({ id: Str, kind: Str, threshold: number(), title: Str })
const Rule = object({
  fact: Str,
  origin: object({ kind: Str, source: Str }),
  rewards: array(Reward),
})
const LedgerSchema = object({ ledger: array(Rule) })

/** An optional row field, as valibot's `optional` parses it. */
type Opt<Value> = Value | undefined
type QuestRow = Readonly<{
  id: string
  completeFlag: string
  startWhen?: Opt<Readonly<{ all?: Opt<readonly string[]> }>>
  track?: Opt<boolean>
  steps: readonly StepRow[]
  onComplete?: Opt<
    Readonly<{ coins?: Opt<number>; fact?: Opt<string>; scene?: Opt<string> }>
  >
}>
type StepRow = Readonly<{
  id: string
  done: Readonly<{
    all?: Opt<readonly string[]>
    any?: Opt<readonly string[]>
  }>
}>
type Row = Readonly<{ id: string; species: string }>

function section(file: string): unknown {
  const at = path.join(BRASSCAP, 'sections', file)
  return JSON.parse(readFileSync(at, 'utf8'))
}

function questData(): Readonly<{
  flags: readonly string[]
  quests: readonly QuestRow[]
}> {
  return parse(QuestsSchema, section('quests/quests.json')).quests
}

function mesa(): QuestRow {
  const row = questData().quests.find(
    (quest: QuestRow): boolean => quest.id === MESA,
  )
  assert.ok(row, 'the mesa quest')
  return row
}

/** Engine's death flag for each spawn of a species. */
function dead(species: string): string[] {
  const file = section('actors/creatures.json')
  return parse(CreaturesSchema, file)
    .creatures.spawns.filter((row: Row): boolean => row.species === species)
    .map((row: Row): string => `dead:${row.id}`)
}

test('BM-6: the mesa quest leads from spawn: rifle, camps, Wyrm', (): void => {
  const [first] = questData().quests
  assert.equal(first?.id, MESA, 'the first quest is the chip')
  const quest = mesa()
  assert.equal(quest.startWhen, undefined, 'no NPC: it starts on spawn')
  assert.notEqual(quest.track, false)
  assert.deepEqual(
    quest.steps.map((row: StepRow): string => row.id),
    ['rifle', 'camp-1', 'camp-2', 'camp-3', 'wyrm'],
  )
})

test('BM-6: any kill proves the rifle; the Wyrm step is its death', (): void => {
  assert.deepEqual(dead('brasscap.wyrm'), [WYRM])
  const kills = [...dead('brasscap.target'), ...dead('brasscap.bandit'), WYRM]
  const { steps } = mesa()
  assert.deepEqual(new Set(steps[0]?.done.any), new Set(kills))
  assert.deepEqual(steps.at(-1)?.done, { all: [WYRM] })
  const { flags } = questData()
  assert.deepEqual(
    kills.filter((flag: string): boolean => !flags.includes(flag)),
    [],
    'every death flag is declared',
  )
})

test('BM-6: the quest pays coins and files a rewarded fact', (): void => {
  const { onComplete } = mesa()
  assert.equal(onComplete?.coins, 25)
  assert.equal(onComplete.fact, MESA)
  const { ledger } = parse(LedgerSchema, section('economy/ledger.json'))
  assert.deepEqual(ledger, [
    {
      fact: MESA,
      origin: { kind: 'engine', source: 'quest.complete' },
      rewards: [
        {
          id: 'brasscap.mesaCleared',
          kind: 'achievement',
          threshold: 1,
          title: 'Tamer of the mesa',
        },
      ],
    },
  ])
})

test('BM-6: the gate is an untracked quest, so one chip shows', (): void => {
  const { quests } = questData()
  const gate = quests.find(
    (row: QuestRow): boolean => row.completeFlag === GATE_FLAG,
  )
  assert.equal(gate?.track, false)
  assert.equal(gate.onComplete?.scene, GATE_FLAG)
  const tracked = quests.filter((row: QuestRow): boolean => row.track !== false)
  assert.equal(tracked.length, 1)
})
