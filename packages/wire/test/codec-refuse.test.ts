import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BitReader } from '../src/bit-reader.ts'
import { BitWriter } from '../src/bit-writer.ts'
import { compileDecoder, compileEncoder } from '../src/codec.ts'
import { readRecords, readUvarint, writeRecord } from '../src/framing.ts'
import { readMessage } from '../src/game.ts'
import { decodeTable } from '../src/table-read.ts'
import { refuses } from './helpers/codec.ts'

import type { WireNode } from '../src/grammar.ts'

// WR3: every 5.1 malformed case refuses: a truncated, overlong or non-minimal
// uvarint, a length past the end, a repeated singleton, trailing bits in a
// body, and a hostile table.

const CONTINUE = 128
const FULL = 255

test('a truncated, overlong or non-minimal uvarint refuses', (): void => {
  refuses((): unknown => readUvarint(Uint8Array.of(CONTINUE), 0, 1))
  const six = Uint8Array.of(CONTINUE, CONTINUE, CONTINUE, CONTINUE, CONTINUE, 1)
  refuses((): unknown => readUvarint(six, 0, six.length))
  refuses((): unknown => readUvarint(Uint8Array.of(CONTINUE + 2, 0), 0, 2))
  const over = Uint8Array.of(CONTINUE, CONTINUE, CONTINUE, CONTINUE, 16)
  refuses((): unknown => readUvarint(over, 0, over.length))
  const top = Uint8Array.of(FULL, FULL, FULL, FULL, 15)
  assert.deepEqual(readUvarint(top, 0, top.length), {
    value: 4_294_967_295,
    next: 5,
  })
})

test('a length past the end, or a repeated singleton, refuses', (): void => {
  refuses((): unknown => readRecords(Uint8Array.of(2, 5, 1), 0, 3))
  const twice: number[] = []
  writeRecord(twice, 2, Uint8Array.of(0))
  writeRecord(twice, 2, Uint8Array.of(0))
  refuses((): unknown => readMessage(Uint8Array.from(twice)))
  const events: number[] = []
  writeRecord(events, 6, Uint8Array.of(0, 0, 0, 1))
  writeRecord(events, 6, Uint8Array.of(0, 0, 0, 2))
  assert.equal(readMessage(Uint8Array.from(events)).records.length, 2)
})

test('a body with trailing bits refuses at its own end', (): void => {
  const node: WireNode = { kind: 'uint', bits: 3 }
  const writer = new BitWriter()
  compileEncoder(node)(writer, 5)
  const bytes = writer.take()
  const reader = new BitReader(bytes, 0, bytes.length)
  assert.equal(compileDecoder(node, node)(reader), 5)
  reader.end()
  const late = new BitReader(Uint8Array.of((bytes[0] ?? 0) + 1), 0, 1)
  compileDecoder(node, node)(late)
  refuses((): void => {
    late.end()
  })
})

test('a hostile table refuses: an unknown kind, a deep nest, an unsound node', (): void => {
  refuses((): unknown => decodeTable(Uint8Array.of(1, 1, 99), 0, 3))
  // Optional of optional ... of bool, past the depth bound.
  const deep = [1, 1, ...Array.from({ length: 12 }, (): number => 11), 2]
  refuses((): unknown => decodeTable(Uint8Array.from(deep), 0, deep.length))
  // A uint of 40 bits is not a node a descriptor could declare.
  refuses((): unknown => decodeTable(Uint8Array.of(1, 1, 1, 40), 0, 4))
  assert.equal(decodeTable(Uint8Array.of(1, 1, 1, 8), 0, 4).length, 1)
})
