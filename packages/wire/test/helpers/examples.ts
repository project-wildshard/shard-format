import { eventsDecoder, eventTables } from '../../src/event-stream.ts'
import {
  actCodec,
  clientTables,
  commandsCodec,
  decodeBody,
} from '../../src/game.ts'
import { decodeFirstMessage, decodeWelcome } from '../../src/handshake.ts'
import { WireDecodeError } from '../../src/wire-error.ts'
import { onlyRecord } from './codec.ts'

// Read a v1 byte example the way its receiver would: the first message, a
// welcome, an events record, or a cmds or act record by the client's tables.

/** A first message's hello; throws for any close answer. */
function readHello(bytes: Readonly<Uint8Array>): unknown {
  const first = decodeFirstMessage(bytes)
  if (first.kind !== 'hello') {
    throw new WireDecodeError(first.kind)
  }
  return first.hello
}

/** Read one example by the receiver its name names; throws on a refusal. */
function readExample(name: string, bytes: Readonly<Uint8Array>): unknown {
  if (name.startsWith('hello')) {
    return readHello(bytes)
  }
  const span = onlyRecord(bytes)
  if (name.startsWith('welcome')) {
    return decodeWelcome(span)
  }
  if (name.startsWith('events')) {
    return eventsDecoder(eventTables())(span)
  }
  const { commandTable, actTable } = clientTables()
  const codec = name.startsWith('act')
    ? actCodec(actTable)
    : commandsCodec(commandTable)
  return decodeBody(codec, span)
}

export { readExample }
