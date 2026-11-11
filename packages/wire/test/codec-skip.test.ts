import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BitWriter } from '../src/bit-writer.ts'
import { compileEncoder } from '../src/codec.ts'
import { writeRecord } from '../src/framing.ts'
import {
  actCodec,
  commandsCodec,
  decodeBody,
  readMessage,
} from '../src/game.ts'
import { WIRE_ACTS, WIRE_COMMAND } from '../src/records.ts'
import { encodeTable } from '../src/tables.ts'
import { onlyRecord } from './helpers/codec.ts'

import type { WireStruct } from '../src/codec.ts'
import type { WireField, WireNode } from '../src/grammar.ts'

// WR3: an unknown field, arm and record is skipped and its neighbours apply;
// a field the sender lacks reads its default.

const struct = (fields: readonly WireField[]): WireNode => ({
  kind: 'struct',
  fields,
})
const U16 = { kind: 'uint', bits: 16 } as const
const TEXT = { kind: 'text', maxBytes: 255 } as const
/** A newer client: a command field and an act arm this server lacks. */
const NEWER_COMMAND = struct([
  ...WIRE_COMMAND.fields.slice(0, 6),
  { id: 99, name: 'grapple', node: { kind: 'optional', node: U16 } },
  ...WIRE_COMMAND.fields.slice(6),
])
const DANCE = {
  id: 12,
  name: 'dance',
  fields: [{ id: 1, name: 'move', node: TEXT }],
}
const NEWER_ACTS: WireNode = { ...WIRE_ACTS, arms: [...WIRE_ACTS.arms, DANCE] }
const STILL = { keyX: 0, keyY: 0, stickX: 0, stickY: 0 }
const COMMAND = {
  seq: 1,
  viewTick: 2,
  steer: STILL,
  yaw: 0,
  pitch: -Math.PI / 2,
  buttons: 3,
  buttonsHigh: undefined,
  attack: undefined,
  heavyTarget: 5,
  lockTarget: undefined,
  hookTarget: 9,
  launcher: undefined,
}

/** One record of `tag` whose body is `node`, written by its own encoder. */
function encodeWith(
  node: WireNode,
  tag: number,
  value: WireStruct,
): Uint8Array {
  const writer = new BitWriter()
  compileEncoder(node)(writer, value)
  const out: number[] = []
  writeRecord(out, tag, writer.take())
  return Uint8Array.from(out)
}

/** A `cmds` body whose commands are `command`. */
function cmdsOf(command: WireNode): WireNode {
  return struct([
    { id: 1, name: 'ackFrame', node: { kind: 'uint', bits: 32 } },
    {
      id: 2,
      name: 'commands',
      node: { kind: 'array', node: command, maxCount: 7 },
    },
  ])
}

test('an unknown record between two known ones is skipped', (): void => {
  const out: number[] = []
  writeRecord(out, 2, Uint8Array.of(0))
  writeRecord(out, 99, Uint8Array.of(7, 7))
  writeRecord(out, 3, Uint8Array.of(0))
  const { records, skipped } = readMessage(Uint8Array.from(out))
  assert.deepEqual(
    records.map((record: { readonly tag: number }): number => record.tag),
    [2, 3],
  )
  assert.deepEqual(skipped, [99])
})

test('an unknown command field is skipped and every later bit holds', (): void => {
  const table = encodeTable([{ id: 1, name: 'command', node: NEWER_COMMAND }])
  const sent = { ...COMMAND, grapple: 77 }
  const bytes = encodeWith(cmdsOf(NEWER_COMMAND), 2, {
    ackFrame: 1,
    commands: [sent, sent],
  })
  assert.deepEqual(decodeBody(commandsCodec(table), onlyRecord(bytes)), {
    ackFrame: 1,
    commands: [COMMAND, COMMAND],
  })
})

test('an unknown act arm is read and skipped', (): void => {
  const table = encodeTable([{ id: 1, name: 'act', node: NEWER_ACTS }])
  const body = struct([
    { id: 1, name: 'seq', node: U16 },
    { id: 2, name: 'act', node: NEWER_ACTS },
  ])
  const dance = { arm: 'dance', fields: { move: 'spin' } }
  const bytes = encodeWith(body, 3, { seq: 4, act: dance })
  assert.deepEqual(decodeBody(actCodec(table), onlyRecord(bytes)), {
    seq: 4,
    act: undefined,
  })
})

test('a command field the sender lacks reads its default', (): void => {
  const older = struct(
    WIRE_COMMAND.fields.filter(
      (field: WireField): boolean =>
        field.name !== 'launcher' && field.name !== 'viewTick',
    ),
  )
  const table = encodeTable([{ id: 1, name: 'command', node: older }])
  const { viewTick, launcher, ...sent } = COMMAND
  assert.deepEqual([viewTick, launcher], [2, undefined])
  const bytes = encodeWith(cmdsOf(older), 2, { ackFrame: 0, commands: [sent] })
  assert.deepEqual(decodeBody(commandsCodec(table), onlyRecord(bytes)), {
    ackFrame: 0,
    commands: [{ ...sent, viewTick: 0, launcher: undefined }],
  })
})
