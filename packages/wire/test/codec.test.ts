import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BitReader } from '../src/bit-reader.ts'
import { BitWriter } from '../src/bit-writer.ts'
import { compileDecoder, compileEncoder } from '../src/codec.ts'
import {
  actCodec,
  clientTables,
  commandsCodec,
  decodeBody,
  encodeBody,
  localCodecs,
  TAG_ACT,
  TAG_CMDS,
} from '../src/game.ts'
import { WIRE_ACTS, WIRE_COMMAND } from '../src/records.ts'
import { onlyRecord } from './helpers/codec.ts'

import type { WireStruct, WireValue } from '../src/codec.ts'
import type { WireNode } from '../src/grammar.ts'

// WR3: every command and act form round-trips through the record codec, and
// absent, false, zero and empty stay four different values.

/* oxlint-disable id-length -- world axes are x, y and z on the wire */
const AIM = {
  origin: { x: 1.5, y: -2.25, z: 3 },
  direction: { x: 0, y: 0.5, z: -1 },
}
/* oxlint-enable id-length */
const STEER = { keyX: 1, keyY: -1, stickX: 0, stickY: 64 / 127 }
const BASE = {
  seq: 65_535,
  viewTick: 7,
  steer: STEER,
  yaw: (3 / 65_536) * Math.PI * 2,
  pitch: -Math.PI / 2,
  buttons: 255,
  buttonsHigh: undefined,
  attack: undefined,
  heavyTarget: undefined,
  lockTarget: undefined,
  hookTarget: undefined,
  launcher: undefined,
}
const COMMANDS: readonly WireStruct[] = [
  BASE,
  { ...BASE, buttonsHigh: 1 },
  { ...BASE, buttonsHigh: 0 },
  { ...BASE, attack: { targetId: undefined, aim: AIM } },
  { ...BASE, attack: { targetId: 7, aim: AIM } },
  { ...BASE, heavyTarget: 3, lockTarget: 0, hookTarget: 0 },
  { ...BASE, launcher: { slot: 31, ads: 1, fire: true } },
  { ...BASE, launcher: { slot: 0, ads: 0, fire: false } },
]
const ACTS: readonly WireStruct[] = [
  { arm: 'interact', fields: { id: 'story:door' } },
  { arm: 'reload', fields: { slot: 2 } },
  { arm: 'equip', fields: { slot: 255 } },
  { arm: 'chat', fields: { channel: 'proximity', text: 'héllo' } },
  { arm: 'report', fields: { line: 4_294_967_295 } },
  { arm: 'ride', fields: { action: 'dismount' } },
  { arm: 'climate', fields: { op: 'day', name: 'noon', at: -1 } },
  { arm: 'buy', fields: { good: 65_535 } },
  { arm: 'board', fields: { op: 'tear', slot: 3 } },
  { arm: 'wear', fields: { id: 'hat' } },
  { arm: 'pose', fields: { names: 'a,b' } },
]
const MAYBE_BYTE = {
  kind: 'optional',
  node: { kind: 'uint', bits: 8 },
} as const
const DISTINCT: WireNode = {
  kind: 'struct',
  fields: [
    { id: 1, name: 'absent', node: MAYBE_BYTE },
    { id: 2, name: 'zero', node: MAYBE_BYTE },
    { id: 3, name: 'off', node: { kind: 'bool' } },
    {
      id: 4,
      name: 'empty',
      node: { kind: 'optional', node: { kind: 'text', maxBytes: 255 } },
    },
    {
      id: 5,
      name: 'none',
      node: { kind: 'array', node: { kind: 'f32' }, maxCount: 255 },
    },
  ],
}

function roundTrip(node: WireNode, value: WireValue): WireValue {
  const writer = new BitWriter()
  compileEncoder(node)(writer, value)
  const bytes = writer.take()
  const reader = new BitReader(bytes, 0, bytes.length)
  const out = compileDecoder(node, node)(reader)
  reader.end()
  return out
}

test('every command form round-trips through a cmds record', (): void => {
  const local = localCodecs()
  const server = commandsCodec(clientTables().commandTable)
  for (const commands of [COMMANDS.slice(0, 7), COMMANDS.slice(7), []]) {
    const bundle = { ackFrame: 4_000_000_000, commands }
    const bytes = encodeBody(local.commands, TAG_CMDS, bundle)
    assert.deepEqual(decodeBody(server, onlyRecord(bytes)), bundle)
  }
  assert.throws(
    (): unknown =>
      encodeBody(local.commands, TAG_CMDS, { ackFrame: 0, commands: COMMANDS }),
    /at most 7/u,
  )
})

test('absent, false, zero and empty decode as four different values', (): void => {
  const value = { absent: undefined, zero: 0, off: false, empty: '', none: [] }
  assert.deepEqual(roundTrip(DISTINCT, value), value)
  assert.deepEqual(roundTrip(WIRE_COMMAND, BASE), BASE)
})

test('every act arm round-trips through an act record', (): void => {
  const local = localCodecs()
  const server = actCodec(clientTables().actTable)
  assert.equal(ACTS.length, WIRE_ACTS.arms.length)
  for (const act of ACTS) {
    const body = { seq: 9, act }
    const bytes = encodeBody(local.act, TAG_ACT, body)
    assert.deepEqual(decodeBody(server, onlyRecord(bytes)), body)
  }
})

test('an enum word the receiver lacks reads its default', (): void => {
  const sender: WireNode = {
    kind: 'enum',
    values: ['room', 'proximity', 'world'],
    default: 'room',
  }
  const receiver: WireNode = {
    kind: 'enum',
    values: ['room', 'proximity'],
    default: 'room',
  }
  const writer = new BitWriter()
  compileEncoder(sender)(writer, 'world')
  const reader = new BitReader(writer.take(), 0, 1)
  assert.equal(compileDecoder(sender, receiver)(reader), 'room')
})
