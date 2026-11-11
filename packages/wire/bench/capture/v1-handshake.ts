import { clientTables } from '../../src/game.ts'
import {
  decodeFirstMessage,
  decodeWelcome,
  encodeHello,
  encodeWelcome,
  tableHash,
} from '../../src/handshake.ts'
import { onlyRecord, packetOf } from './v1-packet.ts'
import { TABLES } from './v1-session.ts'

import type { PacketInput } from './packet-input.ts'
import type { V1Packet } from './v1-packet.ts'

// WB2: a captured hello or welcome said the v1 way: the same player, build
// and room facts, plus the tables v1 adds (gated apart, at 2 KB).

type Input<Kind extends PacketInput['kind']> = Extract<
  PacketInput,
  { kind: Kind }
>['value']

const HASH = tableHash([
  TABLES.classTables,
  TABLES.eventTables,
  TABLES.rideLawTables,
])
const MINOR = 0

/** A captured v0 hello as v1 work. */
function helloPacket(value: Readonly<Input<'hello'>>): V1Packet {
  const hello = {
    minor: MINOR,
    build: value.build,
    player: value.player,
    name: value.name,
    ledger: value.ledger,
    capabilities: [],
    ...clientTables(),
  }
  return packetOf('hello', {
    encode: (): Uint8Array<ArrayBuffer> => encodeHello(hello),
    decode: (bytes: Readonly<Uint8Array>): unknown => decodeFirstMessage(bytes),
  })
}

/** A captured v0 welcome as v1 work, with the whole table set. */
function welcomePacket(value: Readonly<Input<'welcome'>>): V1Packet {
  const welcome = {
    minor: MINOR,
    build: '',
    handle: value.handle,
    player: value.player,
    tick: value.tick,
    cell: value.cell,
    simHz: value.simHz,
    frameHz: value.frameHz,
    capabilities: [],
    requiredCapabilities: [],
    tableHash: HASH,
    tables: TABLES,
  }
  return packetOf('welcome', {
    encode: (): Uint8Array<ArrayBuffer> => encodeWelcome(welcome),
    decode: (bytes: Readonly<Uint8Array>): unknown =>
      decodeWelcome(onlyRecord(bytes)),
  })
}

export { helloPacket, welcomePacket }
