import { countBits, indexBits } from './bounds.ts'
import { generateStructEncoder } from './encode-gen.ts'
import { fixedCodec } from './fixed.ts'
import { asArm, asList, asNumber, asStruct } from './values.ts'

import type { BitSink } from './bit-io.ts'
import type { WireField, WireNode } from './grammar.ts'
import type { WireValue } from './values.ts'

// WIRE-STABILITY 5.3: every node compiles once into an encoder, a closure
// over its bounds, so a message writes in a plain loop. The sender always
// writes in its own declared layout; its table travels in the handshake.

/** Write one value of one node. */
type Encode = (writer: BitSink, value: WireValue) => void
type Node<Kind extends WireNode['kind']> = Extract<WireNode, { kind: Kind }>

const ZERO = 0
const ONE = 1
const TWO = 2
const TAU = Math.PI * TWO
const REF_BITS = 16
const REF_TOP = 65_535
const BYTE = 8
const utf8 = new TextEncoder()

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high)

function uintEncoder(bits: number): Encode {
  const top = TWO ** bits - ONE
  return (writer: BitSink, value: WireValue): void => {
    const rounded = Math.round(asNumber(value))
    writer.write(clamp(rounded, ZERO, top), bits)
  }
}

function quantEncoder(node: Node<'quant'>): Encode {
  const step = (node.max - node.min) / (TWO ** node.bits - ONE)
  return (writer: BitSink, value: WireValue): void => {
    const held = clamp(asNumber(value), node.min, node.max)
    writer.write(Math.round((held - node.min) / step), node.bits)
  }
}

function fixedEncoder(node: Node<'fixed'>): Encode {
  const codec = fixedCodec(node.bits, node.divisor, node.offset)
  const top = TWO ** node.bits - ONE
  return (writer: BitSink, value: WireValue): void => {
    const word = codec.encode(asNumber(value))
    writer.write(clamp(word, ZERO, top), node.bits)
  }
}

function angleEncoder(bits: number): Encode {
  const turns = TWO ** bits
  return (writer: BitSink, value: WireValue): void => {
    const turn = ((asNumber(value) % TAU) + TAU) % TAU
    writer.write(Math.round((turn / TAU) * turns) % turns, bits)
  }
}

function enumEncoder(values: readonly string[]): Encode {
  const index = new Map(
    values.map((word: string, at: number): readonly [string, number] => [
      word,
      at,
    ]),
  )
  const bits = indexBits(values.length)
  return (writer: BitSink, value: WireValue): void => {
    const at = typeof value === 'string' ? index.get(value) : undefined
    if (at === undefined) {
      throw new RangeError(`Undeclared enum value ${JSON.stringify(value)}`)
    }
    writer.write(at, bits)
  }
}

function textEncoder(maxBytes: number): Encode {
  return (writer: BitSink, value: WireValue): void => {
    const bytes = utf8.encode(typeof value === 'string' ? value : '')
    if (bytes.length > maxBytes) {
      throw new RangeError('Net text exceeds its byte cap')
    }
    writer.write(bytes.length, BYTE)
    for (const byte of bytes) {
      writer.write(byte, BYTE)
    }
  }
}

function boolEncoder(writer: BitSink, value: WireValue): void {
  writer.write(value === true ? ONE : ZERO, ONE)
}
function f32Encoder(writer: BitSink, value: WireValue): void {
  writer.writeF32(asNumber(value))
}
function f64Encoder(writer: BitSink, value: WireValue): void {
  writer.writeF64(asNumber(value))
}
function refEncoder(writer: BitSink, value: WireValue): void {
  const handle = Math.round(asNumber(value))
  writer.write(clamp(handle, ZERO, REF_TOP), REF_BITS)
}

function optionalEncoder(inner: Encode): Encode {
  return (writer: BitSink, value: WireValue): void => {
    writer.write(value === undefined ? ZERO : ONE, ONE)
    if (value !== undefined) {
      inner(writer, value)
    }
  }
}

function arrayEncoder(inner: Encode, maxCount: number): Encode {
  const bits = countBits(maxCount)
  return (writer: BitSink, value: WireValue): void => {
    const list = asList(value)
    if (list.length > maxCount) {
      throw new RangeError(`An array holds at most ${String(maxCount)} values`)
    }
    writer.write(list.length, bits)
    for (const item of list) {
      inner(writer, item)
    }
  }
}

function structEncoder(fields: readonly WireField[]): Encode {
  // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
  return generateStructEncoder(fields, compileEncoder) ?? loopEncoder(fields)
}

/** The closure form, where a page refuses generated code (a CSP). */
function loopEncoder(fields: readonly WireField[]): Encode {
  // Parallel arrays and an index loop: this runs per field per message (WB2).
  const names = fields.map((field: WireField): string => field.name)
  const encoders = fields.map(
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    (field: WireField): Encode => compileEncoder(field.node),
  )
  const count = names.length
  return (writer: BitSink, value: WireValue): void => {
    const struct = asStruct(value)
    for (let index = ZERO; index < count; index += ONE) {
      encoders[index]?.(writer, struct[names[index] ?? ''])
    }
  }
}

function unionEncoder(node: Node<'union'>): Encode {
  const byName = new Map<string, readonly [number, Encode]>()
  for (const arm of node.arms) {
    byName.set(arm.name, [arm.id, structEncoder(arm.fields)])
  }
  return (writer: BitSink, value: WireValue): void => {
    const { arm, fields } = asArm(value)
    const entry = byName.get(arm)
    if (entry === undefined) {
      throw new RangeError(`Undeclared arm ${arm}`)
    }
    const [id, encode] = entry
    writer.write(id, node.bits)
    encode(writer, fields)
  }
}

const FLAT = {
  bool: boolEncoder,
  f32: f32Encoder,
  f64: f64Encoder,
  ref: refEncoder,
}

/** A node with no inner node: its encoder; undefined for a nesting node. */
function scalarEncoder(node: WireNode): Encode | undefined {
  switch (node.kind) {
    case 'uint': {
      return uintEncoder(node.bits)
    }
    case 'quant': {
      return quantEncoder(node)
    }
    case 'fixed': {
      return fixedEncoder(node)
    }
    case 'angle': {
      return angleEncoder(node.bits)
    }
    case 'enum': {
      return enumEncoder(node.values)
    }
    case 'text': {
      return textEncoder(node.maxBytes)
    }
    case 'bool':
    case 'f32':
    case 'f64':
    case 'ref': {
      return FLAT[node.kind]
    }
    case 'optional':
    case 'array':
    case 'struct':
    case 'union': {
      return undefined
    }
    default: {
      throw new RangeError('Unknown wire node')
    }
  }
}

/** Compile one node's encoder. */
function compileEncoder(node: WireNode): Encode {
  // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
  return scalarEncoder(node) ?? nestedEncoder(node)
}

function nestedEncoder(node: WireNode): Encode {
  if (node.kind === 'optional') {
    return optionalEncoder(compileEncoder(node.node))
  }
  if (node.kind === 'array') {
    return arrayEncoder(compileEncoder(node.node), node.maxCount)
  }
  if (node.kind === 'struct') {
    return structEncoder(node.fields)
  }
  if (node.kind === 'union') {
    return unionEncoder(node)
  }
  throw new RangeError('Unknown wire node')
}

export { countBits, indexBits } from './bounds.ts'
export { compileEncoder, type Encode }
