import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { array, looseObject, number, parse, string } from 'valibot'

import { checkWire } from '../cli/check.ts'
import { ANIMAL, PLAYER, WIRE_CLASSES } from '../src/classes.ts'
import { wireLockText } from '../src/lock.ts'
import { v0SchemaHash } from '../src/v0.ts'

import type { WireClass, WireClassField } from '../src/grammar.ts'

const LOCK = readFileSync(new URL('../wire.lock.json', import.meta.url), 'utf8')
const BASELINE_TEXT = readFileSync(
  new URL('../wire.v0.lock.json', import.meta.url),
  'utf8',
)
/** Enough of the baseline to edit it, keeping every other key. */
const EditableField = looseObject({ name: string(), kind: string() })
const EditableClass = looseObject({
  name: string(),
  fields: array(EditableField),
})
const EditableEvent = looseObject({
  tag: number(),
  name: string(),
  form: string(),
})
const EditableCommand = looseObject({ fields: array(string()) })
const Editable = looseObject({
  classes: array(EditableClass),
  events: array(EditableEvent),
  command: EditableCommand,
})

function baseline(): unknown {
  const parsed: unknown = JSON.parse(BASELINE_TEXT)
  return parsed
}

/** `player` fields added after the WS2 baseline: `name`, RP6's three, MP1.5's two. */
const PLAYER_ADDED = new Set([
  'name',
  'swing',
  'heavy',
  'air',
  'roadX',
  'roadZ',
])

function notName(field: WireClassField): boolean {
  return !PLAYER_ADDED.has(field.name)
}

/** `animal` fields added after the WS2 baseline: `species` (24), then CC28's channels and lock (25 to 29), then MP5.2b's road place (30, 31), then CC11a2c's running ability (32, 33). */
const ANIMAL_BASELINE_LAST = 23

function notSpecies(field: WireClassField): boolean {
  return field.id <= ANIMAL_BASELINE_LAST
}

function withoutPlayerName(wireClass: WireClass): WireClass {
  if (wireClass === ANIMAL) {
    return { ...ANIMAL, fields: ANIMAL.fields.filter(notSpecies) }
  }
  return wireClass === PLAYER
    ? { ...PLAYER, fields: PLAYER.fields.filter(notName) }
    : wireClass
}

test('the committed lock is what the descriptors generate', (): void => {
  assert.equal(wireLockText(), LOCK)
  assert.deepEqual(checkWire(`${LOCK} `, baseline()).problems, [
    'wire.lock.json is stale: run `pnpm lock` and commit it',
  ])
})

test('the descriptors write engine main and cfd6681 v0 hashes exactly', (): void => {
  // Engine main's NET_SCHEMA_HASH, which binds these descriptors (WR2), with
  // `animal.species` (TE-ENG7), `player.swing`, `heavy`, `air` (RP6), the
  // animal's four channels and lock answer (ONE-FORMAT CC28),
  // `player.roadX`, `roadZ` (MMO-PLAN MP1.5), `animal.roadX`, `roadZ`
  // (MMO-PLAN MP5.2b) and `animal.ability`, `abilityT` (ONE-FORMAT CC11a2c).
  assert.equal(v0SchemaHash(WIRE_CLASSES), 35_583_310)
  // Without the player and animal fields added after the WS2 baseline:
  // exact cfd6681.
  assert.equal(
    v0SchemaHash(
      WIRE_CLASSES.map((wireClass: WireClass): WireClass =>
        withoutPlayerName(wireClass),
      ),
    ),
    3_951_578_209,
  )
})

test('against the WS2 baseline everything is kept and seventeen ids added', (): void => {
  const result = checkWire(LOCK, baseline())
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.added, [
    'player.name #54',
    'player.swing #55',
    'player.heavy #56',
    'player.air #57',
    'player.roadX #58',
    'player.roadZ #59',
    'animal.species #24',
    'animal.channel1 #25',
    'animal.channel2 #26',
    'animal.channel3 #27',
    'animal.channel4 #28',
    'animal.lockable #29',
    'animal.roadX #30',
    'animal.roadZ #31',
    'animal.ability #32',
    'animal.abilityT #33',
    'event.flight #16',
  ])
  // 99 class fields; 6 message, 15 event and 11 act tags; 69 event and 15
  // act body fields; 16 command forms.
  assert.equal(result.kept, 231)
})

test('a changed, removed or renumbered baseline entry refuses', (): void => {
  const changed = parse(Editable, baseline())
  const hp = changed.classes[1]?.fields[12]
  const hit = changed.events.at(2)
  assert.equal(hp?.name, 'hp')
  assert.equal(hit?.name, 'hit')
  hp.kind = 'u8'
  hit.tag = 40
  assert.deepEqual(checkWire(LOCK, changed).problems, [
    'animal.hp changed or is gone',
    'event hit (#40) moved',
  ])
})

test('a body field v1 lacks, or has at another width, refuses by name', (): void => {
  const changed = parse(Editable, baseline())
  const died = changed.events.at(3)
  assert.equal(died?.name, 'died')
  died.form = died.form.replace('impulse:f32', 'impulse:f64')
  changed.command.fields[0] = 'seq:u8'
  changed.command.fields.push('grapple:u8')
  assert.deepEqual(checkWire(LOCK, changed).problems, [
    'event died: impulse:f64 changed or is gone',
    'command: seq:u8 changed or is gone',
    'command: grapple:u8 changed or is gone',
  ])
})
