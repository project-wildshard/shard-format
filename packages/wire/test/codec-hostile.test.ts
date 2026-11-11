import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BitReader } from '../src/bit-reader.ts'
import { BitWriter } from '../src/bit-writer.ts'
import { compileDecoder, compileEncoder } from '../src/codec.ts'
import { readMessage } from '../src/game.ts'
import { decodeTable } from '../src/table-read.ts'
import { encodeTable } from '../src/tables.ts'
import { refuses } from './helpers/codec.ts'

import type { WireNode } from '../src/grammar.ts'

// WR3 review (J206) MUSTs: a hostile table cannot expand a few bytes into
// unbounded work or throw anything but a refusal; a mismatched kind reads the
// receiver's default; text keeps a leading BOM; an empty message, tag 0 or a
// bad enum default refuses. handshake.test.ts holds the cold-record MUSTs.

const table = (node: WireNode): Uint8Array =>
  encodeTable([{ id: 1, name: 'x', node }])
const BOOL = { kind: 'bool' } as const
const BOM = String.fromCodePoint(65_279)

test('a table with an unbounded or empty-element array, a zero divisor or an infinite quant refuses', (): void => {
  for (const node of [
    { kind: 'array', node: BOOL, maxCount: 256 },
    { kind: 'array', node: { kind: 'struct', fields: [] }, maxCount: 7 },
    { kind: 'fixed', bits: 8, divisor: 0, offset: 0 },
    { kind: 'quant', min: -1e308, max: 1e308, bits: 16 },
    { kind: 'quant', min: 0, max: Number.POSITIVE_INFINITY, bits: 16 },
  ] satisfies readonly WireNode[]) {
    const bytes = table(node)
    refuses((): unknown => decodeTable(bytes, 0, bytes.length))
  }
})

test('a sender node of another kind is read, skipped, and reads the default', (): void => {
  const sender: WireNode = {
    kind: 'struct',
    fields: [
      {
        id: 1,
        name: 'first',
        node: { kind: 'optional', node: { kind: 'uint', bits: 8 } },
      },
      { id: 2, name: 'second', node: { kind: 'uint', bits: 8 } },
    ],
  }
  const receiver: WireNode = {
    kind: 'struct',
    fields: [
      { id: 1, name: 'first', node: { kind: 'uint', bits: 8 } },
      { id: 2, name: 'second', node: { kind: 'uint', bits: 8 } },
    ],
  }
  const writer = new BitWriter()
  compileEncoder(sender)(writer, { first: 7, second: 9 })
  const bytes = writer.take()
  const value = compileDecoder(
    sender,
    receiver,
  )(new BitReader(bytes, 0, bytes.length))
  assert.deepEqual(value, { first: 0, second: 9 })
})

test('a leading BOM survives text', (): void => {
  const node: WireNode = { kind: 'text', maxBytes: 255 }
  const writer = new BitWriter()
  compileEncoder(node)(writer, `${BOM}hello`)
  const bytes = writer.take()
  assert.equal(
    compileDecoder(node, node)(new BitReader(bytes, 0, bytes.length)),
    `${BOM}hello`,
  )
})

test('an empty message or a tag 0 refuses', (): void => {
  refuses((): unknown => readMessage(new Uint8Array(0)))
  refuses((): unknown => readMessage(Uint8Array.of(0, 0)))
})

test('an enum default past its values refuses', (): void => {
  // Entry 1: an enum of one word, `a`, whose default index is 5.
  refuses((): unknown => decodeTable(Uint8Array.of(1, 1, 8, 1, 1, 97, 5), 0, 7))
})
