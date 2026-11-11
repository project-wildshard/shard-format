import { countBits, indexBits } from './encode.ts'
import { fixedCodec } from './fixed.ts'
import { defaultValue, isStruct, structDefaults } from './values.ts'
import { WireDecodeError } from './wire-error.ts'

import type { BitSource } from './bit-io.ts'
import type { WireArm, WireField, WireNode } from './grammar.ts'
import type { WireStruct, WireValue } from './values.ts'

// WIRE-STABILITY 5.3 and 5.4: a receiver decodes by the sender's table and
// projects onto its own. A sender field the receiver has no slot for is read
// and dropped, so every later bit stays aligned; a receiver field the sender
// lacks reads its default. Every node is bounded, so a skip is a decode.

/** Read one value of the sender's node, as the receiver's node holds it. */
type Decode = (reader: BitSource) => WireValue
type Node<Kind extends WireNode['kind']> = Extract<WireNode, { kind: Kind }>

const ZERO = 0
const ONE = 1
const TWO = 2
const TAU = Math.PI * TWO
const REF_BITS = 16
const BYTE = 8
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

function readText(reader: BitSource, maxBytes: number): string {
  const length = reader.read(BYTE)
  if (length > maxBytes || length * BYTE > reader.remaining) {
    throw new WireDecodeError('Text overruns its bound')
  }
  const bytes = new Uint8Array(length)
  for (let index = ZERO; index < length; index += ONE) {
    bytes[index] = reader.read(BYTE)
  }
  try {
    return utf8.decode(bytes)
  } catch {
    throw new WireDecodeError('Text is not UTF-8')
  }
}

function enumDecoder(
  sender: Node<'enum'>,
  receiver: WireNode | undefined,
): Decode {
  const bits = indexBits(sender.values.length)
  const local = receiver?.kind === 'enum' ? receiver : undefined
  const known = new Set<string>(local?.values ?? sender.values)
  return (reader: BitSource): WireValue => {
    const word = sender.values[reader.read(bits)]
    if (word === undefined) {
      throw new WireDecodeError('An enum index is past its values')
    }
    // Words map by string; one the receiver doesn't know reads its default.
    return known.has(word) ? word : local?.default
  }
}

function quantDecoder(node: Node<'quant'>): Decode {
  const step = (node.max - node.min) / (TWO ** node.bits - ONE)
  return (reader: BitSource): WireValue =>
    node.min + reader.read(node.bits) * step
}

function fixedDecoder(node: Node<'fixed'>): Decode {
  const codec = fixedCodec(node.bits, node.divisor, node.offset)
  return (reader: BitSource): WireValue => codec.decode(reader.read(node.bits))
}

function angleDecoder(bits: number): Decode {
  const turns = TWO ** bits
  return (reader: BitSource): WireValue => (reader.read(bits) / turns) * TAU
}

const FLAT = {
  bool: (reader: BitSource): WireValue => reader.read(ONE) === ONE,
  f32: (reader: BitSource): WireValue => reader.readF32(),
  f64: (reader: BitSource): WireValue => reader.readF64(),
  ref: (reader: BitSource): WireValue => reader.read(REF_BITS),
}

/** A node with no inner node: its decoder; undefined for a nesting node. */
function scalarDecoder(node: WireNode): Decode | undefined {
  switch (node.kind) {
    case 'uint': {
      return (reader: BitSource): WireValue => reader.read(node.bits)
    }
    case 'quant': {
      return quantDecoder(node)
    }
    case 'fixed': {
      return fixedDecoder(node)
    }
    case 'angle': {
      return angleDecoder(node.bits)
    }
    case 'text': {
      return (reader: BitSource): WireValue => readText(reader, node.maxBytes)
    }
    case 'bool':
    case 'f32':
    case 'f64':
    case 'ref': {
      return FLAT[node.kind]
    }
    case 'enum':
    case 'optional':
    case 'array':
    case 'struct':
    case 'union': {
      return undefined
    }
    default: {
      throw new WireDecodeError('Unknown wire node')
    }
  }
}

function optionalDecoder(inner: Decode): Decode {
  return (reader: BitSource): WireValue =>
    reader.read(ONE) === ONE ? inner(reader) : undefined
}

function arrayDecoder(inner: Decode, maxCount: number): Decode {
  const bits = countBits(maxCount)
  return (reader: BitSource): WireValue => {
    const count = reader.read(bits)
    if (count > maxCount || count > reader.remaining) {
      throw new WireDecodeError('An array count is past its bound')
    }
    const out: WireValue[] = []
    for (let index = ZERO; index < count; index += ONE) {
      out.push(inner(reader))
    }
    return out
  }
}

/** Each sender field's decoder, and the receiver's name for it, if any. */
function fieldParts(
  sender: readonly WireField[],
  receiver: readonly WireField[] | undefined,
): readonly (readonly [string | undefined, Decode])[] {
  const parts: (readonly [string | undefined, Decode])[] = []
  for (const field of sender) {
    const slot = receiver?.find(
      (entry: WireField): boolean => entry.id === field.id,
    )
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    parts.push([slot?.name, compileDecoder(field.node, slot?.node)])
  }
  return parts
}

function structDecoder(
  sender: readonly WireField[],
  receiver: readonly WireField[] | undefined,
): Decode {
  const parts = fieldParts(sender, receiver)
  const defaults = structDefaults(receiver ?? [])
  return (reader: BitSource): WireValue => {
    const out: Record<string, WireValue> = { ...defaults }
    for (const [name, decode] of parts) {
      const value = decode(reader)
      if (name !== undefined) {
        out[name] = value
      }
    }
    return out
  }
}

function unionDecoder(
  sender: Node<'union'>,
  receiver: WireNode | undefined,
): Decode {
  const mine = receiver?.kind === 'union' ? receiver.arms : []
  const arms = new Map<number, readonly [string | undefined, Decode]>()
  for (const arm of sender.arms) {
    const local = mine.find((entry: WireArm): boolean => entry.id === arm.id)
    arms.set(arm.id, [local?.name, structDecoder(arm.fields, local?.fields)])
  }
  return (reader: BitSource): WireValue => {
    const arm = arms.get(reader.read(sender.bits))
    if (arm === undefined) {
      throw new WireDecodeError('An arm id is not in its sender table')
    }
    const fields = arm[ONE](reader)
    // An arm the receiver lacks is read and skipped: no value.
    return arm[ZERO] === undefined || !isStruct(fields)
      ? undefined
      : { arm: arm[ZERO], fields: fields satisfies WireStruct }
  }
}

/** The inner node a receiver declares for a sender's optional or array. */
function innerOf(
  sender: WireNode,
  receiver: WireNode | undefined,
): WireNode | undefined {
  return receiver?.kind === sender.kind && 'node' in receiver
    ? receiver.node
    : undefined
}

function wrappedDecoder(
  sender: WireNode,
  receiver: WireNode | undefined,
): Decode | undefined {
  if (sender.kind !== 'optional' && sender.kind !== 'array') {
    return undefined
  }
  // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
  const inner = compileDecoder(sender.node, innerOf(sender, receiver))
  return sender.kind === 'array'
    ? arrayDecoder(inner, sender.maxCount)
    : optionalDecoder(inner)
}

function nestedDecoder(
  sender: WireNode,
  receiver: WireNode | undefined,
): Decode {
  const wrapped = wrappedDecoder(sender, receiver)
  if (wrapped !== undefined) {
    return wrapped
  }
  if (sender.kind === 'struct') {
    return structDecoder(
      sender.fields,
      receiver?.kind === 'struct' ? receiver.fields : undefined,
    )
  }
  if (sender.kind === 'union') {
    return unionDecoder(sender, receiver)
  }
  if (sender.kind === 'enum') {
    return enumDecoder(sender, receiver)
  }
  throw new WireDecodeError('Unknown wire node')
}

/** A sender's scalar read as a receiver of another kind: its default. */
function retyped(simple: Decode, receiver: WireNode): Decode {
  const fallback = defaultValue(receiver)
  return (reader: BitSource): WireValue => {
    simple(reader)
    return fallback
  }
}

/** Compile one decoder: the sender's layout, projected onto the receiver's. */
function compileDecoder(
  sender: WireNode,
  receiver: WireNode | undefined,
): Decode {
  // A retype is a new id; a mismatched kind is read, skipped, and reads as
  // the receiver's default.
  const local = receiver?.kind === sender.kind ? receiver : undefined
  const read = scalarDecoder(sender) ?? nestedDecoder(sender, local)
  return receiver === undefined || local !== undefined
    ? read
    : retyped(read, receiver)
}

export { compileDecoder, type Decode }
