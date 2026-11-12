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

function notName(field: WireClassField): boolean {
  return field.name !== 'name'
}

function notSpecies(field: WireClassField): boolean {
  return field.name !== 'species'
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
  // `animal.species` (TE-ENG7).
  assert.equal(v0SchemaHash(WIRE_CLASSES), 516_954_244)
  // Without `player.name` and `animal.species`, added after the WS2
  // baseline: exact cfd6681.
  assert.equal(
    v0SchemaHash(
      WIRE_CLASSES.map((wireClass: WireClass): WireClass =>
        withoutPlayerName(wireClass),
      ),
    ),
    3_951_578_209,
  )
})

test('against the WS2 baseline everything is kept and two fields added', (): void => {
  const result = checkWire(LOCK, baseline())
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.added, ['player.name #54', 'animal.species #24'])
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
