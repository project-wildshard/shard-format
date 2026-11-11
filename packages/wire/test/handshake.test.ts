import assert from 'node:assert/strict'
import { test } from 'node:test'

import { eventTables } from '../src/event-stream.ts'
import { readRecords, writeRecord } from '../src/framing.ts'
import { clientTables } from '../src/game.ts'
import {
  decodeFirstMessage,
  decodeWelcome,
  encodeHello,
  encodeWelcome,
  tableHash,
} from '../src/handshake.ts'

// WR3: the bootstrap answers a v0.1.x hello with `reload`; the cold records
// refuse a missing required field or a repeated one and skip an unknown one;
// a welcome carries tables, and a travel welcome only their hash.

const BOOT = 87
const HELLO = {
  minor: 0,
  build: 'v0.2.0',
  player: 'p-1',
  name: 'Ann',
  ledger: 12,
  capabilities: [3, 200],
  ...clientTables(),
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
  tick: 123_456,
  cell: 2,
  simHz: 60,
  frameHz: 30,
  capabilities: [3],
  requiredCapabilities: [],
  tableHash: tableHash([
    TABLES.classTables,
    TABLES.eventTables,
    TABLES.rideLawTables,
  ]),
}

/** A first message whose hello body is `inner`. */
function helloWith(inner: readonly number[]): Uint8Array {
  const out = [BOOT, 1]
  writeRecord(out, 1, Uint8Array.from(inner))
  return Uint8Array.from(out)
}

function welcomeOf(bytes: Readonly<Uint8Array>): unknown {
  const [record] = readRecords(bytes, 0, bytes.length)
  assert.ok(record)
  return decodeWelcome({ bytes, start: record.start, end: record.end })
}

test('a v0.1.x hello reloads; a lower major reloads, a higher retries', (): void => {
  assert.deepEqual(decodeFirstMessage(Uint8Array.of(1, 0, 0, 0)), {
    kind: 'reload',
  })
  assert.deepEqual(decodeFirstMessage(Uint8Array.of(BOOT, 0)), {
    kind: 'reload',
  })
  assert.deepEqual(decodeFirstMessage(Uint8Array.of(BOOT, 2)), {
    kind: 'retry',
  })
  assert.deepEqual(decodeFirstMessage(Uint8Array.of(BOOT + 1, 1)), {
    kind: 'refuse',
  })
  assert.deepEqual(decodeFirstMessage(encodeHello(HELLO)), {
    kind: 'hello',
    hello: HELLO,
  })
})

/** The encoded hello's record body, as a list. */
function helloBody(): number[] {
  const bytes = encodeHello(HELLO)
  const [record] = readRecords(bytes, 2, bytes.length)
  assert.ok(record)
  return [...bytes.subarray(record.start, record.end)]
}

test('a hello missing a required field, or repeating one, refuses', (): void => {
  const body = helloBody()
  // Field 1 (minor) is key 8, then 0: dropping it leaves no minor.
  assert.deepEqual(body.slice(0, 2), [8, 0])
  const refuse = { kind: 'refuse' }
  const missing = helloWith(body.slice(2))
  assert.deepEqual(decodeFirstMessage(missing), refuse)
  assert.deepEqual(decodeFirstMessage(helloWith([8, 0, ...body])), refuse)
})

test('an unknown cold field is skipped by its wire type', (): void => {
  // Field 31 as a uvarint, then field 31 as bytes, then the real hello.
  const unknown = [248, 1, 5, 251, 1, 2, 97, 98, ...helloBody()]
  assert.deepEqual(decodeFirstMessage(helloWith(unknown)), {
    kind: 'hello',
    hello: HELLO,
  })
})

test('a welcome carries tables; a travel welcome only their hash', (): void => {
  const full = encodeWelcome({ ...WELCOME, tables: TABLES })
  const travel = encodeWelcome(WELCOME)
  assert.ok(travel.length + TABLES.eventTables.length < full.length)
  assert.deepEqual(welcomeOf(full), { ...WELCOME, tables: TABLES })
  assert.deepEqual(welcomeOf(travel), WELCOME)
})

test('a cold text past 255 bytes refuses', (): void => {
  const name = Array.from({ length: 256 }, (): number => 97)
  // Minor 0, player `p-1`, a 256-byte name, then both empty client tables.
  const body = [8, 0, 26, 3, 112, 45, 49, 34, 128, 2, ...name, 58, 0, 66, 0]
  assert.deepEqual(decodeFirstMessage(helloWith(body)), { kind: 'refuse' })
})

test('a welcome holding some but not all of its table blocks refuses', (): void => {
  const full = encodeWelcome({ ...WELCOME, tables: TABLES })
  const travel = encodeWelcome(WELCOME)
  assert.notEqual(welcomeOf(full), undefined)
  // The travel welcome's body, plus classTables (field 12) alone.
  const [record] = readRecords(travel, 0, travel.length)
  assert.ok(record)
  const out: number[] = []
  writeRecord(
    out,
    4,
    Uint8Array.from([...travel.subarray(record.start, record.end), 99, 1, 0]),
  )
  assert.throws(
    (): unknown => welcomeOf(Uint8Array.from(out)),
    /some of its table blocks/u,
  )
})

test('a cold value no uvarint holds refuses before any byte is written', (): void => {
  for (const ledger of [
    -1,
    0.5,
    Number.NaN,
    2 ** 32,
    Number.POSITIVE_INFINITY,
  ]) {
    assert.throws(
      (): Uint8Array => encodeHello({ ...HELLO, ledger }),
      RangeError,
    )
  }
  assert.equal(encodeHello({ ...HELLO, ledger: 2 ** 32 - 1 }).length > 0, true)
})
