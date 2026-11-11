/* oxlint-disable typescript/prefer-readonly-parameter-types -- frozen v0's captured inputs and FrameInput are mutable types */
import { encodeEvents } from '../../src/event-stream.ts'
import { WIRE_EVENTS } from '../../src/events.ts'
import {
  decodeBody,
  encodeBody,
  localBodyNode,
  localCodecs,
  TAG_ACT,
  TAG_CMDS,
} from '../../src/game.ts'
import { taggedRecord, taggedRecordBytes, varintBytes } from './tagged-bytes.ts'
import { onlyRecord, packetOf } from './v1-packet.ts'
import { readEvents, SERVER, SPAWNS } from './v1-session.ts'
import { v1Act, v1Command, v1Event } from './v1-values.ts'

import type { WireEvent } from '../../src/game.ts'
import type { WireField } from '../../src/grammar.ts'
import type { WireStruct } from '../../src/values.ts'
import type { PacketInput } from './packet-input.ts'
import type { V1Packet } from './v1-packet.ts'

// WB2: the hot records (cmds, act, events) said the v1 way, with their
// per-field-tag sizes (5.6) beside them.

type Input<Kind extends PacketInput['kind']> = Extract<
  PacketInput,
  { kind: Kind }
>['value']

const NONE = 0
const LOCAL = localCodecs()

/** A record body's local fields, by tag. */
function bodyFields(tag: number): readonly WireField[] {
  const node = localBodyNode(tag)
  return node.kind === 'struct' ? node.fields : []
}

/** An events message in the per-field-tag shape: tick, then each event. */
function taggedEvents(tick: number, events: readonly WireEvent[]): number {
  let body = varintBytes(tick)
  for (const event of events) {
    const record = WIRE_EVENTS.find(
      (entry: (typeof WIRE_EVENTS)[number]): boolean =>
        entry.name === event.event,
    )
    body +=
      record === undefined
        ? NONE
        : taggedRecordBytes(record.fields, event.fields)
  }
  return taggedRecord(body)
}

/** A captured v0 command bundle as v1 work. */
function commandsPacket(value: Readonly<Input<'commands'>>): V1Packet {
  const bundle = {
    ackFrame: value.ackFrame,
    commands: value.commands.map(
      (command: (typeof value.commands)[number]): WireStruct =>
        v1Command(command),
    ),
  }
  return packetOf('commands', {
    encode: (): Uint8Array<ArrayBuffer> =>
      encodeBody(LOCAL.commands, TAG_CMDS, bundle),
    decode: (bytes: Readonly<Uint8Array>): unknown =>
      decodeBody(SERVER.commands, onlyRecord(bytes)),
    tagged: taggedRecordBytes(bodyFields(TAG_CMDS), bundle),
  })
}

/** A captured v0 act as v1 work. */
function actPacket(value: Readonly<Input<'act'>>): V1Packet {
  const act = v1Act(value)
  return packetOf('act', {
    encode: (): Uint8Array<ArrayBuffer> => encodeBody(LOCAL.act, TAG_ACT, act),
    decode: (bytes: Readonly<Uint8Array>): unknown =>
      decodeBody(SERVER.act, onlyRecord(bytes)),
    tagged: taggedRecordBytes(bodyFields(TAG_ACT), act),
  })
}

/** A captured v0 events message as v1 work. */
function eventsPacket(value: Readonly<Input<'events'>>): V1Packet {
  const events = value.events.map(
    (event: (typeof value.events)[number]): WireEvent => v1Event(event),
  )
  return packetOf('events', {
    encode: (): Uint8Array<ArrayBuffer> =>
      encodeEvents(value.tick, events, SPAWNS),
    decode: (bytes: Readonly<Uint8Array>): unknown =>
      readEvents(onlyRecord(bytes)),
    tagged: taggedEvents(value.tick, events),
  })
}

export { actPacket, commandsPacket, eventsPacket }
