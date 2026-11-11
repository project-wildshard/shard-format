import { decodeCommands, encodeCommands } from '../../frozen/v0/command.ts'
import {
  decodeAct,
  decodeEvents,
  decodeHello,
  decodeWelcome,
  encodeAct,
  encodeEvents,
  encodeHello,
  encodeWelcome,
  MSG_HELLO,
  MSG_CMDS,
  MSG_ACT,
  MSG_WELCOME,
  MSG_EVENTS,
} from '../../frozen/v0/messages.ts'
import { V0_CLASSES } from '../../frozen/v0/tables.ts'

import type { BitWriter } from '../../frozen/v0/bits.ts'
import type { InitialBits } from '../../frozen/v0/messages.ts'

type PacketInput =
  | {
      readonly kind: 'hello'
      readonly value: NonNullable<ReturnType<typeof decodeHello>>
    }
  | {
      readonly kind: 'commands'
      readonly value: NonNullable<ReturnType<typeof decodeCommands>>
    }
  | {
      readonly kind: 'act'
      readonly value: NonNullable<ReturnType<typeof decodeAct>>
    }
  | {
      readonly kind: 'welcome'
      readonly value: NonNullable<ReturnType<typeof decodeWelcome>>
    }
  | {
      readonly kind: 'events'
      readonly value: NonNullable<ReturnType<typeof decodeEvents>>
    }
type DeepRead<Value> = Value extends object
  ? { readonly [Key in keyof Value]: DeepRead<Value[Key]> }
  : Value
const ZERO = 0
const NO_HANDLE = 0
const HANDLE_TOP = 65_535
const PREFIX = 'captured-handle:'
function initial(cls: number): ReturnType<InitialBits> {
  const table = V0_CLASSES.find((row): boolean => row.id === cls)
  return table === undefined
    ? undefined
    : {
        bits: table.initial.map((column): number => column.bits),
        text: table.text.length,
      }
}
function ids(handle: number): string | undefined {
  return handle > NO_HANDLE && handle <= HANDLE_TOP
    ? `${PREFIX}${String(handle)}`
    : undefined
}
function refs(id: string): number {
  const handle = Number(id.slice(PREFIX.length))
  if (!id.startsWith(PREFIX) || ids(handle) !== id) {
    throw new Error('Invalid captured command handle')
  }
  return handle
}
function required<Value>(value: Value | null): Value {
  if (value === null) {
    throw new Error('Frozen v0 refuses captured packet')
  }
  return value
}
/** Retain parsed sender input outside timing; timed encoding still selects its codec here. */
function encodePacketInput(
  input: DeepRead<PacketInput>,
  shared: () => BitWriter,
): ArrayBuffer {
  const writer = shared()
  switch (input.kind) {
    case 'hello': {
      return encodeHello(writer, input.value)
    }
    case 'commands': {
      return encodeCommands(writer, input.value, refs)
    }
    case 'act': {
      return encodeAct(writer, input.value)
    }
    case 'welcome': {
      return encodeWelcome(writer, input.value)
    }
    case 'events': {
      return encodeEvents(writer, input.value.tick, input.value.events, initial)
    }
    default: {
      throw new Error('Unknown prepared packet kind')
    }
  }
}
/** Actual common prefix dispatch stays inside every timed receiver operation. */
function decodePacketValue(bytes: Readonly<Uint8Array>): unknown {
  switch (bytes.at(ZERO) ?? ZERO) {
    case MSG_HELLO: {
      return required(decodeHello(bytes))
    }
    case MSG_CMDS: {
      return required(decodeCommands(bytes, ids))
    }
    case MSG_ACT: {
      return required(decodeAct(bytes))
    }
    case MSG_WELCOME: {
      return required(decodeWelcome(bytes))
    }
    case MSG_EVENTS: {
      return required(decodeEvents(bytes, initial))
    }
    default: {
      throw new Error('Non-frame packet capture requires a frozen v0 stream')
    }
  }
}
function readPacketInput(bytes: Readonly<Uint8Array>): PacketInput {
  switch (bytes.at(ZERO) ?? ZERO) {
    case MSG_HELLO: {
      return { kind: 'hello', value: required(decodeHello(bytes)) }
    }
    case MSG_CMDS: {
      return { kind: 'commands', value: required(decodeCommands(bytes, ids)) }
    }
    case MSG_ACT: {
      return { kind: 'act', value: required(decodeAct(bytes)) }
    }
    case MSG_WELCOME: {
      return { kind: 'welcome', value: required(decodeWelcome(bytes)) }
    }
    case MSG_EVENTS: {
      return { kind: 'events', value: required(decodeEvents(bytes, initial)) }
    }
    default: {
      throw new Error('Non-frame packet capture requires a frozen v0 stream')
    }
  }
}
export {
  encodePacketInput,
  decodePacketValue,
  readPacketInput,
  type PacketInput,
}
