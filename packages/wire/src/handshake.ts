import { decodeCold, encodeCold } from './cold.ts'
import {
  bootstrapBytes,
  readBootstrap,
  readRecords,
  readUvarint,
  writeRecord,
  writeUvarint,
} from './framing.ts'
import { WIRE_MAJOR } from './major.ts'
import { HELLO, WELCOME } from './records.ts'
import { WireDecodeError } from './wire-error.ts'

import type { Span } from './bit-io.ts'
import type { ColdValue, ColdValues } from './cold.ts'

// WIRE-STABILITY 5.1, 5.3 and 5.5: the bootstrap and the two cold records.
// A v1 client's first message is `W`, WIRE_MAJOR, then the hello record. The
// welcome carries the server's tables, or only their hash on a travel to a
// cell whose tables this socket already holds.

/** What a client says first: its minor, build, identity and tables. */
interface Hello {
  readonly minor: number
  readonly build: string
  readonly player: string
  readonly name: string
  readonly ledger: number
  readonly capabilities: readonly number[]
  readonly commandTable: Readonly<Uint8Array>
  readonly actTable: Readonly<Uint8Array>
}
/** The server's tables; absent on a travel welcome with a held hash. */
interface ServerTables {
  readonly classTables: Readonly<Uint8Array>
  readonly eventTables: Readonly<Uint8Array>
  readonly rideLawTables: Readonly<Uint8Array>
}
/** The server's seat for a client. */
interface Welcome {
  readonly minor: number
  readonly build: string
  readonly handle: number
  readonly player: string
  readonly tick: number
  readonly cell: number
  readonly simHz: number
  readonly frameHz: number
  readonly capabilities: readonly number[]
  readonly requiredCapabilities: readonly number[]
  readonly tableHash: number
  readonly tables?: ServerTables
}
/** A first message, read: a hello, or what to close with (5.5). */
type FirstMessage =
  | { readonly kind: 'hello'; readonly hello: Hello }
  | { readonly kind: 'reload' | 'retry' | 'refuse' }

const HELLO_TAG = 1
const WELCOME_TAG = 4
const ZERO = 0
const ONE = 1
const THREE = 3
const utf8Out = new TextEncoder()
const utf8In = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
/** Net text's cap (`MAX_NET_TEXT_BYTES`), cold or hot. */
const MAX_TEXT_BYTES = 255
const FNV_OFFSET = 2_166_136_261
const FNV_PRIME = 16_777_619

/** FNV-1a over table bytes: `tableHash` (5.3). It refuses nothing. */
function tableHash(blocks: readonly Readonly<Uint8Array>[]): number {
  let hash = FNV_OFFSET
  for (const block of blocks) {
    for (const byte of block) {
      // oxlint-disable-next-line no-bitwise -- FNV-1a is xor and 32-bit multiply
      hash = Math.imul(hash ^ byte, FNV_PRIME) >>> ZERO
    }
  }
  return hash
}

function idsBytes(ids: readonly number[]): Readonly<Uint8Array> {
  const out: number[] = []
  for (const id of ids) {
    writeUvarint(out, id)
  }
  return Uint8Array.from(out)
}

function readIds(value: ColdValues[string]): readonly number[] {
  if (!(value instanceof Uint8Array)) {
    return []
  }
  const ids: number[] = []
  for (let at = ZERO; at < value.length;) {
    const read = readUvarint(value, at, value.length)
    ids.push(read.value)
    at = read.next
  }
  return ids
}

function textOf(value: ColdValues[string]): string {
  if (!(value instanceof Uint8Array)) {
    return ''
  }
  if (value.length > MAX_TEXT_BYTES) {
    throw new WireDecodeError('A cold text exceeds 255 bytes')
  }
  try {
    return utf8In.decode(value)
  } catch {
    throw new WireDecodeError('A cold text is not UTF-8')
  }
}

const numberOf = (value: ColdValues[string]): number =>
  typeof value === 'number' ? value : ZERO
const bytesOf = (value: ColdValues[string]): Readonly<Uint8Array> =>
  value instanceof Uint8Array ? value : new Uint8Array(ZERO)

/** A v1 client's first message: bootstrap, then the hello record. */
function encodeHello(hello: Hello): Uint8Array {
  const body = encodeCold(HELLO, {
    minor: hello.minor,
    build: utf8Out.encode(hello.build),
    player: utf8Out.encode(hello.player),
    name: utf8Out.encode(hello.name),
    ledger: hello.ledger,
    capabilities: idsBytes(hello.capabilities),
    commandTable: hello.commandTable,
    actTable: hello.actTable,
  })
  const out = [...bootstrapBytes(WIRE_MAJOR)]
  writeRecord(out, HELLO_TAG, body)
  return Uint8Array.from(out)
}

function helloOf(values: ColdValues): Hello {
  return {
    minor: numberOf(values['minor']),
    build: textOf(values['build']),
    player: textOf(values['player']),
    name: textOf(values['name']),
    ledger: numberOf(values['ledger']),
    capabilities: readIds(values['capabilities']),
    commandTable: bytesOf(values['commandTable']),
    actTable: bytesOf(values['actTable']),
  }
}

/** The one hello record after the bootstrap, or undefined. */
function helloSpan(
  bytes: Readonly<Uint8Array>,
  start: number,
): Span | undefined {
  const records = readRecords(bytes, start, bytes.length)
  const [record] = records
  return records.length === ONE && record?.tag === HELLO_TAG
    ? { bytes, start: record.start, end: record.end }
    : undefined
}

/** Read a client's first message: the bootstrap bytes before any record. */
function decodeFirstMessage(bytes: Readonly<Uint8Array>): FirstMessage {
  const bootstrap = readBootstrap(bytes, WIRE_MAJOR)
  if (bootstrap.kind !== 'v1') {
    return bootstrap
  }
  try {
    const span = helloSpan(bytes, bootstrap.start)
    return span === undefined
      ? { kind: 'refuse' }
      : { kind: 'hello', hello: helloOf(decodeCold(HELLO, span)) }
  } catch (error) {
    if (error instanceof WireDecodeError) {
      return { kind: 'refuse' }
    }
    throw error
  }
}

/** The welcome record, with its tables unless `tables` is absent. */
function encodeWelcome(welcome: Welcome): Uint8Array {
  const values: Record<string, ColdValue> = {
    minor: welcome.minor,
    build: utf8Out.encode(welcome.build),
    handle: welcome.handle,
    player: utf8Out.encode(welcome.player),
    tick: welcome.tick,
    cell: welcome.cell,
    simHz: welcome.simHz,
    frameHz: welcome.frameHz,
    capabilities: idsBytes(welcome.capabilities),
    requiredCapabilities: idsBytes(welcome.requiredCapabilities),
    tableHash: welcome.tableHash,
    ...welcome.tables,
  }
  const out: number[] = []
  writeRecord(out, WELCOME_TAG, encodeCold(WELCOME, values))
  return Uint8Array.from(out)
}

/** All three table blocks, or none: a travel welcome holds none. */
function tablesOf(values: ColdValues): ServerTables | undefined {
  const { classTables, eventTables, rideLawTables } = values
  const held = [classTables, eventTables, rideLawTables].filter(
    (block: ColdValues[string]): boolean => block instanceof Uint8Array,
  ).length
  if (held === ZERO) {
    return undefined
  }
  if (held !== THREE) {
    throw new WireDecodeError('A welcome holds some of its table blocks')
  }
  return {
    classTables: bytesOf(classTables),
    eventTables: bytesOf(eventTables),
    rideLawTables: bytesOf(rideLawTables),
  }
}

/** Read a welcome record's body. */
function decodeWelcome(span: Span): Welcome {
  const values = decodeCold(WELCOME, span)
  const tables = tablesOf(values)
  return {
    minor: numberOf(values['minor']),
    build: textOf(values['build']),
    handle: numberOf(values['handle']),
    player: textOf(values['player']),
    tick: numberOf(values['tick']),
    cell: numberOf(values['cell']),
    simHz: numberOf(values['simHz']),
    frameHz: numberOf(values['frameHz']),
    capabilities: readIds(values['capabilities']),
    requiredCapabilities: readIds(values['requiredCapabilities']),
    tableHash: numberOf(values['tableHash']),
    ...(tables === undefined ? {} : { tables }),
  }
}

export {
  decodeFirstMessage,
  decodeWelcome,
  encodeHello,
  encodeWelcome,
  tableHash,
  type FirstMessage,
  type Hello,
  type ServerTables,
  type Welcome,
}
