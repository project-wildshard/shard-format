import assert from 'node:assert/strict'
import { test } from 'node:test'

import { encodeEvents } from '../src/event-stream.ts'
import { readRecords, writeRecord } from '../src/framing.ts'
import { commandsCodec, clientTables, decodeBody } from '../src/game.ts'
import { decodeTable } from '../src/table-read.ts'
import { encodeTable } from '../src/tables.ts'
import { onlyRecord, refuses } from './helpers/codec.ts'

import type { WireNode } from '../src/grammar.ts'

// WR3's Opus review (J206): a nested field of no bits refuses, so a body's
// bits bound its decode work; a throwing event encode leaks no bits into the
// next message; the 64 KiB cap, a whole trailing byte, a union too narrow
// for its arms and out-of-range text bounds refuse; and a seeded fuzz over
// codec-fuzz.test.ts holds the seeded fuzz.

const tableOf = (node: WireNode): Uint8Array =>
  encodeTable([{ id: 1, name: 'x', node }])

test('a nested field of no bits refuses, so decode work is bounded by body bits', (): void => {
  const empty: WireNode = { kind: 'struct', fields: [] }
  const hollow: WireNode = {
    kind: 'struct',
    fields: [
      { id: 1, name: 'flag', node: { kind: 'bool' } },
      { id: 2, name: 'void', node: empty },
    ],
  }
  const nested: WireNode = { kind: 'array', node: hollow, maxCount: 255 }
  for (const node of [hollow, nested]) {
    const bytes = tableOf(node)
    refuses((): unknown => decodeTable(bytes, 0, bytes.length))
  }
  // A top-level entry may hold no fields: its record costs bytes anyway.
  const bare = tableOf(empty)
  assert.equal(decodeTable(bare, 0, bare.length).length, 1)
})

test('a throwing event encode leaks no bits into the next events message', (): void => {
  const hit = { event: 'phase', fields: { tick: 1, flag: 'f', on: true } }
  const before = encodeEvents(9, [hit])
  assert.throws((): unknown =>
    encodeEvents(9, [
      {
        event: 'chat',
        fields: {
          tick: 1,
          line: 1,
          channel: 'shout',
          from: 0,
          name: '',
          text: '',
        },
      },
    ]),
  )
  assert.deepEqual(encodeEvents(9, [hit]), before)
})

test('the 64 KiB cap, a trailing byte, a narrow union and bad text bounds refuse', (): void => {
  refuses((): unknown => readRecords(new Uint8Array(65_537), 0, 65_537))
  const { commandTable } = clientTables()
  const out: number[] = []
  writeRecord(out, 2, Uint8Array.of(0, 0, 0, 7, 0, 0))
  refuses((): unknown =>
    decodeBody(commandsCodec(commandTable), onlyRecord(Uint8Array.from(out))),
  )
  const narrow: WireNode = {
    kind: 'union',
    bits: 1,
    default: 'a',
    arms: [
      { id: 1, name: 'a', fields: [] },
      { id: 2, name: 'b', fields: [] },
      { id: 3, name: 'c', fields: [] },
    ],
  }
  for (const node of [
    narrow,
    { kind: 'text', maxBytes: 0 },
    { kind: 'text', maxBytes: 256 },
  ] satisfies readonly WireNode[]) {
    const bytes = tableOf(node)
    refuses((): unknown => decodeTable(bytes, 0, bytes.length))
  }
})
