/* oxlint-disable typescript/prefer-readonly-parameter-types, no-magic-numbers -- a session collects its problems as it runs, and its fixtures name their own numbers */
import { ANIMAL, KITE, roomClasses } from './cross-frames.ts'

import type { ClassColumns } from '../../src/columns.ts'
import type { WireEvent } from '../../src/game.ts'
import type { Codec } from './cross-codec.ts'
import type { Ends } from './cross-frames.ts'

// WR6 (7): the handshake and the hot records between the two codecs: hello
// with the client's tables, cmds and an act read through them, the welcome
// with the room's tables, and an events message with a spawn of a class the
// client lacks, a hit, a reward, a chat line, a mount, a travel and one
// record no version knows. A client that refuses unknown records instead of
// skipping them (`strictEvents`) is the WR3 revert the harness must catch.

/** A one-record message's body. */
interface Span {
  readonly bytes: Readonly<Uint8Array>
  readonly start: number
  readonly end: number
}
/** The session's shape for records, with the WR3 revert as an option. */
interface RecordEnds extends Ends {
  readonly strictEvents: boolean
}

const UNKNOWN = 99
const CHAT = {
  seq: 4,
  act: { arm: 'chat', fields: { channel: 'room', text: 'hello' } },
}
// oxlint-disable-next-line id-length -- the x, y, z axes
const AIM = { origin: { x: 1, y: 2, z: 3 }, direction: { x: 0, y: 1, z: 0 } }
const STEER = { keyX: 0, keyY: 1, stickX: 0, stickY: 0 }
const COMMANDS = [
  {
    seq: 1,
    viewTick: 2,
    steer: STEER,
    yaw: 1,
    pitch: 0,
    buttons: 3,
    attack: { targetId: 7, aim: AIM },
  },
  {
    seq: 2,
    viewTick: 3,
    steer: STEER,
    yaw: 2,
    pitch: 0.5,
    buttons: 0,
    launcher: { slot: 4, ads: 0.5, fire: true },
  },
]

function only(codec: Codec, bytes: Readonly<Uint8Array>): Span {
  const [record] = codec.game.readMessage(bytes).records
  if (record === undefined) {
    throw new Error('a message holds no record')
  }
  return { bytes, start: record.start, end: record.end }
}

/** Hello, then cmds and an act, client to room through the client's own tables. */
function upProblems(ends: Ends): readonly string[] {
  const { client, room } = ends
  const hello = client.handshake.encodeHello({
    minor: 0,
    build: 'client',
    player: 'device:1',
    name: 'Ann',
    ledger: 0,
    capabilities: [],
    ...client.game.clientTables(),
  })
  const first = room.handshake.decodeFirstMessage(hello)
  if (first.kind !== 'hello') {
    return [`the room refused the hello: ${first.kind}`]
  }
  const local = client.game.localCodecs()
  const bundle = room.game.decodeBody(
    room.game.commandsCodec(first.hello.commandTable),
    only(
      room,
      client.game.encodeBody(local.commands, client.game.TAG_CMDS, {
        ackFrame: 9,
        commands: COMMANDS,
      }),
    ),
  )
  const act = room.game.decodeBody(
    room.game.actCodec(first.hello.actTable),
    only(room, client.game.encodeBody(local.act, client.game.TAG_ACT, CHAT)),
  )
  const seen = JSON.stringify({
    ack: bundle['ackFrame'],
    commands: bundle['commands'],
    act,
  })
  return seen.includes('"targetId":7') &&
    seen.includes('"slot":4') &&
    seen.includes('"text":"hello"') &&
    seen.includes('"ack":9')
    ? []
    : [`cmds or act read wrong: ${seen}`]
}

/** The events message with one record no version knows, between the known ones. */
function withUnknown(room: Codec, bytes: Readonly<Uint8Array>): Uint8Array {
  const span = only(room, bytes)
  const body = [...span.bytes.subarray(span.start, span.end)]
  room.framing.writeRecord(body, UNKNOWN, Uint8Array.of(1, 2, 3))
  return room.framing.recordBytes(room.game.TAG_EVENTS, Uint8Array.from(body))
}

const EVENTS: readonly WireEvent[] = [
  {
    event: 'hit',
    fields: {
      tick: 5,
      target: 1,
      amount: 12,
      // oxlint-disable-next-line id-length -- the x, y, z axes
      at: { x: 1, y: 2, z: 3 },
      head: false,
      killed: false,
      blow: false,
      confirmFor: 0,
    },
  },
  { event: 'reward', fields: { tick: 5, coins: 3, body: 1 } },
  {
    event: 'chat',
    fields: {
      tick: 5,
      line: 1,
      channel: 'room',
      from: 2,
      name: 'Ann',
      text: 'hi',
    },
  },
  { event: 'mount', fields: { tick: 5, rider: 1, mount: 2, seq: 0 } },
  { event: 'travel', fields: { tick: 5, from: 0, to: 1 } },
]

/** Spawns of every class in the room's table, the kite included. */
function spawns(room: ReadonlyMap<number, ClassColumns>): readonly WireEvent[] {
  return [ANIMAL, KITE].map((cls: number): WireEvent => {
    const columns = room.get(cls)
    return {
      event: 'spawn',
      fields: {
        handle: cls === ANIMAL ? 1 : 2,
        cls,
        id: `thing:${String(cls)}`,
        initial: (columns?.initial ?? []).map((): number => 1),
        text: (columns?.text ?? []).map((): string => 'boar'),
      },
    }
  })
}

/** The room's class columns and its welcome's table blocks. */
function roomTables(room: Codec): {
  readonly columns: ReadonlyMap<number, ClassColumns>
  readonly tables: {
    readonly classTables: Uint8Array
    readonly eventTables: Uint8Array
    readonly rideLawTables: Uint8Array
  }
} {
  const classes = roomClasses(room)
  return {
    columns: new Map(
      classes.map((entry): readonly [number, ClassColumns] => [
        entry.id,
        room.columns.classColumns(entry),
      ]),
    ),
    tables: {
      classTables: room.classTables.encodeClassTables(classes),
      eventTables: room.eventStream.eventTables(),
      rideLawTables: room.rideTables.encodeRideLawTables([]),
    },
  }
}

/** The room's welcome, as the client reads it. */
function welcomed(
  room: Codec,
  client: Codec,
  tables: ReturnType<typeof roomTables>['tables'],
): ReturnType<Codec['handshake']['decodeWelcome']> {
  const tableHash = room.handshake.tableHash([
    tables.classTables,
    tables.eventTables,
    tables.rideLawTables,
  ])
  const welcome = room.handshake.encodeWelcome({
    minor: 0,
    build: 'room',
    handle: 1,
    player: 'device:1',
    tick: 5,
    cell: 0,
    simHz: 60,
    frameHz: 30,
    capabilities: [],
    requiredCapabilities: [],
    tableHash,
    tables,
  })
  return client.handshake.decodeWelcome(only(client, welcome))
}

/** The client's view of the sender's columns, from the welcome's class tables. */
function senderColumns(
  client: Codec,
  tables: Readonly<Uint8Array>,
): ReadonlyMap<number, ClassColumns> {
  const classes = client.classTables.decodeClassTables(tables)
  return new Map(
    classes.map((entry): readonly [number, ClassColumns] => [
      entry.id,
      client.columns.classColumns(entry),
    ]),
  )
}

/** What the events read as: right, or what went wrong. */
function eventsVerdict(
  read: {
    readonly events: readonly WireEvent[]
    readonly skipped: readonly number[]
  },
  strict: boolean,
): readonly string[] {
  if (strict && read.skipped.length > 0) {
    return [
      `a strict client refused unknown records ${JSON.stringify(read.skipped)}`,
    ]
  }
  const names = read.events
    .map((event: WireEvent): string => event.event)
    .join(',')
  return names === 'spawn,spawn,hit,reward,chat,mount,travel' &&
    read.skipped.includes(UNKNOWN)
    ? []
    : [`events read as ${names}, skipped ${JSON.stringify(read.skipped)}`]
}

/** Welcome and events, room to client, read through the room's tables. */
function downProblems(ends: RecordEnds): readonly string[] {
  const { client, room } = ends
  const { columns, tables } = roomTables(room)
  const welcome = welcomed(room, client, tables)
  const sender = senderColumns(
    client,
    welcome.tables?.classTables ?? new Uint8Array(),
  )
  const roomSpawns = room.spawnColumns.spawnColumns(
    (id: number): ClassColumns | undefined => columns.get(id),
  )
  const events = withUnknown(
    room,
    room.eventStream.encodeEvents(
      5,
      [...spawns(columns), ...EVENTS],
      roomSpawns,
    ),
  )
  const clientSpawns = client.spawnColumns.spawnColumns(
    (id: number): ClassColumns | undefined => sender.get(id),
  )
  const decode = client.eventStream.eventsDecoder(
    welcome.tables?.eventTables ?? new Uint8Array(),
    clientSpawns,
  )
  return eventsVerdict(decode(only(client, events)), ends.strictEvents)
}

/** Every record problem, both ways. */
const recordProblems = (ends: RecordEnds): readonly string[] => [
  ...upProblems(ends),
  ...downProblems(ends),
]

export { recordProblems, type RecordEnds }
