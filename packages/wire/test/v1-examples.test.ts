import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { test } from 'node:test'

import FIXTURES from '../fixtures/v1-examples.json' with { type: 'json' }
import { encodeEvents, eventTables } from '../src/event-stream.ts'
import { readRecords, writeRecord } from '../src/framing.ts'
import { clientTables, encodeBody, localCodecs } from '../src/game.ts'
import { encodeHello, encodeWelcome, tableHash } from '../src/handshake.ts'
import { bytesOf, eventsRecord, onlyRecord, refuses } from './helpers/codec.ts'
import { readExample } from './helpers/examples.ts'

// WIRE-STABILITY 5.1: the v1 record byte examples are frozen in
// fixtures/v1-examples.json. HEAD re-encodes every well-formed one byte for
// byte and reads it; every malformed one refuses. Rewrite the fixture only
// with a wire minor: WIRE_WRITE_EXAMPLES=1 node --test test/v1-examples.test.ts

/** One example: its name and bytes, and whether a reader must refuse it. */
interface Example {
  readonly name: string
  readonly hex: string
  readonly refuse: boolean
}

const hex = (bytes: Readonly<Uint8Array>): string =>
  Buffer.from(bytes).toString('hex')
const ok = (name: string, bytes: Readonly<Uint8Array>): Example => ({
  name,
  hex: hex(bytes),
  refuse: false,
})
const bad = (name: string, text: string): Example => ({
  name,
  hex: text,
  refuse: true,
})
/* oxlint-disable id-length -- world axes are x, y and z on the wire */
const AIM = { origin: { x: 1, y: 2, z: 3 }, direction: { x: 0, y: 0, z: 1 } }
const AT = { x: 260, y: 260, z: -260 }
/* oxlint-enable id-length */
const COMMAND = {
  seq: 1,
  viewTick: 2,
  steer: { keyX: 1, keyY: 0, stickX: 0, stickY: -1 },
  yaw: 0,
  pitch: -Math.PI / 2,
  buttons: 1,
  buttonsHigh: undefined,
  attack: undefined,
  heavyTarget: undefined,
  lockTarget: undefined,
  hookTarget: undefined,
  launcher: undefined,
}
const HIT_FIELDS = {
  tick: 9,
  target: 3,
  amount: 4,
  at: AT,
  head: false,
  killed: true,
  blow: false,
  confirmFor: 1,
}
const HIT = { event: 'hit', fields: HIT_FIELDS }
const REWARD = {
  event: 'reward',
  fields: { tick: 9, coins: 5, body: 3, item: 'gem' },
}
const TABLES = {
  classTables: Uint8Array.of(0),
  eventTables: eventTables(),
  rideLawTables: Uint8Array.of(0),
}
const WELCOME = {
  minor: 0,
  build: 'v0.2.0',
  handle: 4,
  player: 'p-1',
  tick: 100,
  cell: 0,
  simHz: 60,
  frameHz: 30,
  capabilities: [],
  requiredCapabilities: [],
  tableHash: tableHash([
    TABLES.classTables,
    TABLES.eventTables,
    TABLES.rideLawTables,
  ]),
}
const HELLO = {
  minor: 0,
  build: 'v0.2.0',
  player: 'p-1',
  name: 'Ann',
  ledger: 0,
  capabilities: [],
  ...clientTables(),
}

/** Events with tag 40, unknown to every v1.0 reader, between two known. */
function eventsWithUnknown(): Uint8Array {
  const span = onlyRecord(encodeEvents(9, [HIT, REWARD]))
  const tickEnd = span.start + 4
  const [hit, reward] = readRecords(span.bytes, tickEnd, span.end)
  assert.ok(hit && reward)
  const body = bytesOf(span, span.start, tickEnd)
  writeRecord(body, hit.tag, span.bytes.slice(hit.start, hit.end))
  writeRecord(body, 40, Uint8Array.of(171, 205))
  writeRecord(body, reward.tag, span.bytes.slice(reward.start, reward.end))
  return eventsRecord(body)
}

/** Every well-formed example, built by the v1 codec at HEAD. */
function wellFormed(): readonly Example[] {
  const { commands, act } = localCodecs()
  const attack = { ...COMMAND, attack: { targetId: 3, aim: AIM } }
  const chat = { arm: 'chat', fields: { channel: 'room', text: 'hi' } }
  return [
    ok('hello', encodeHello(HELLO)),
    ok('welcome', encodeWelcome({ ...WELCOME, tables: TABLES })),
    ok('welcome-travel', encodeWelcome(WELCOME)),
    ok('cmds', encodeBody(commands, 2, { ackFrame: 7, commands: [COMMAND] })),
    ok(
      'cmds-attack',
      encodeBody(commands, 2, { ackFrame: 7, commands: [attack] }),
    ),
    ok('act-chat', encodeBody(act, 3, { seq: 5, act: chat })),
    ok('events-unknown-between', eventsWithUnknown()),
  ]
}

/** Every example: the well-formed ones, then the 5.1 malformed cases. */
function examples(): readonly Example[] {
  return [
    ...wellFormed(),
    bad('truncated-varint', '0280'),
    bad('overlong-varint', '028080808080'),
    bad('length-past-end', '020501'),
    bad('duplicate-singleton', '020100020100'),
    bad('hello-missing-required', '57010100'),
  ]
}

if (process.env['WIRE_WRITE_EXAMPLES'] === '1') {
  const note =
    'WIRE-STABILITY 5.1 v1 record byte examples, written by the v1 codec (WR3). Regenerate only with a wire minor.'
  writeFileSync(
    new URL('../fixtures/v1-examples.json', import.meta.url),
    `${JSON.stringify({ note, examples: examples() }, undefined, 2)}\n`,
  )
}

test('every example encodes to its frozen bytes', (): void => {
  assert.deepEqual(examples(), FIXTURES.examples)
})

test('every well-formed example reads; every malformed one refuses', (): void => {
  for (const example of FIXTURES.examples) {
    const bytes = Uint8Array.from(Buffer.from(example.hex, 'hex'))
    if (example.refuse) {
      refuses((): unknown => readExample(example.name, bytes))
    } else {
      assert.notEqual(readExample(example.name, bytes), undefined)
    }
  }
})
