/* oxlint-disable typescript/prefer-readonly-parameter-types -- a generator accumulates its body's lines */
import { countBits } from './bounds.ts'
import { fixedCodec } from './fixed.ts'
import { asList, asNumber, asStruct } from './values.ts'

import type { BitSink } from './bit-io.ts'
import type { WireField, WireNode } from './grammar.ts'
import type { WireValue } from './values.ts'

// WB2: a struct's encoder generated as one straight-line function, the way
// v0's hand-written encoders read, so a command or an event body costs no
// closure call per field. Only local descriptors are ever compiled here,
// never a peer's table: every name and bound comes from this package's own
// declarations, and even so each name and bound enters the source only as a
// JSON literal. Nodes with no straight-line form (enum, text, union) call
// their compiled closure. The bytes are the closure encoder's exactly.

/** Write one value of one node (as `encode.ts`'s `Encode`). */
type Encode = (writer: BitSink, value: WireValue) => void
/** The closures a generated body calls by index. */
type Fallback = (node: WireNode) => Encode
type Node<Kind extends WireNode['kind']> = Extract<WireNode, { kind: Kind }>

/** What a generated body is handed: value checks and fallback closures. */
interface Helpers {
  readonly number: typeof asNumber
  readonly struct: typeof asStruct
  readonly list: typeof asList
  readonly calls: readonly Encode[]
}
/** A body being generated, and the closures it calls. */
interface Generator {
  readonly lines: string[]
  readonly calls: Encode[]
  readonly fallback: Fallback
  next: number
}
/** One value to write: its node, and the name holding it in the body. */
interface Target {
  readonly node: WireNode
  readonly value: string
}

const ONE = 1
const TWO = 2
const TAU = Math.PI * TWO
const REF_BITS = 16
const NESTED = new Set<WireNode['kind']>(['optional', 'array', 'struct'])

const literal = (value: number | string): string => JSON.stringify(value)

function variable(generator: Generator): string {
  generator.next += ONE
  return `v${String(generator.next)}`
}

/** Write `target` clamped into [0, high] in `bits`. */
function writeClamped(target: string, high: number, bits: number): string {
  const top = literal(high)
  return `w.write(${target} < 0 ? 0 : ${target} > ${top} ? ${top} : ${target}, ${literal(bits)})`
}

function wholeLines(bits: number, value: string, temp: string): string[] {
  const top = TWO ** bits - ONE
  return [`${temp} = Math.round(n(${value}))`, writeClamped(temp, top, bits)]
}

function quantLines(
  node: Node<'quant'>,
  value: string,
  temp: string,
): string[] {
  const step = literal((node.max - node.min) / (TWO ** node.bits - ONE))
  const [low, high] = [literal(node.min), literal(node.max)]
  return [
    `${temp} = n(${value})`,
    `${temp} = ${temp} < ${low} ? ${low} : ${temp} > ${high} ? ${high} : ${temp}`,
    `w.write(Math.round((${temp} - ${low}) / ${step}), ${literal(node.bits)})`,
  ]
}

function fixedLines(
  node: Node<'fixed'>,
  value: string,
  temp: string,
): string[] {
  const codec = fixedCodec(node.bits, node.divisor, node.offset)
  const scale = `${literal(codec.divisor)}) - ${literal(codec.offset)}`
  return [
    `${temp} = Math.round(n(${value}) * ${scale}`,
    writeClamped(temp, TWO ** node.bits - ONE, node.bits),
  ]
}

function angleLines(bits: number, value: string, temp: string): string[] {
  const [tau, turns] = [literal(TAU), literal(TWO ** bits)]
  return [
    `${temp} = ((n(${value}) % ${tau}) + ${tau}) % ${tau}`,
    `w.write(Math.round((${temp} / ${tau}) * ${turns}) % ${turns}, ${literal(bits)})`,
  ]
}

/** The straight-line lines for a scalar node, or undefined for a closure. */
function scalarLines(target: Target, temp: string): string[] | undefined {
  const { node, value } = target
  switch (node.kind) {
    case 'bool': {
      return [`w.write(${value} === true ? 1 : 0, 1)`]
    }
    case 'uint':
    case 'ref': {
      return wholeLines(node.kind === 'ref' ? REF_BITS : node.bits, value, temp)
    }
    case 'f32':
    case 'f64': {
      return [`w.write${node.kind === 'f32' ? 'F32' : 'F64'}(n(${value}))`]
    }
    case 'quant': {
      return quantLines(node, value, temp)
    }
    case 'fixed': {
      return fixedLines(node, value, temp)
    }
    case 'angle': {
      return angleLines(node.bits, value, temp)
    }
    case 'enum':
    case 'text':
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

/** An array's count, then each item, as a loop in the body. */
function emitArray(
  generator: Generator,
  node: Node<'array'>,
  value: string,
): void {
  const [list, item] = [variable(generator), variable(generator)]
  const message = literal(
    `An array holds at most ${String(node.maxCount)} values`,
  )
  generator.lines.push(
    `const ${list} = a(${value})`,
    `if (${list}.length > ${literal(node.maxCount)}) throw new RangeError(${message})`,
    `w.write(${list}.length, ${literal(countBits(node.maxCount))})`,
    `for (const ${item} of ${list}) {`,
  )
  // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
  emit(generator, { node: node.node, value: item })
  generator.lines.push('}')
}

function emitFields(
  generator: Generator,
  fields: readonly WireField[],
  struct: string,
): void {
  for (const field of fields) {
    const value = variable(generator)
    generator.lines.push(`const ${value} = ${struct}[${literal(field.name)}]`)
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    emit(generator, { node: field.node, value })
  }
}

/** A nesting node: optional, array or struct, written inline. */
function emitNested(generator: Generator, target: Target, temp: string): void {
  const { node, value } = target
  if (node.kind === 'optional') {
    generator.lines.push(
      `w.write(${value} === undefined ? 0 : 1, 1)`,
      `if (${value} !== undefined) {`,
    )
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    emit(generator, { node: node.node, value })
    generator.lines.push('}')
  } else if (node.kind === 'array') {
    emitArray(generator, node, value)
  } else if (node.kind === 'struct') {
    generator.lines.push(`${temp} = s(${value})`)
    emitFields(generator, node.fields, temp)
  }
}

/** Append the lines that write one value. */
function emit(generator: Generator, target: Target): void {
  const temp = variable(generator)
  generator.lines.push(`let ${temp}`)
  const scalar = scalarLines(target, temp)
  if (scalar !== undefined) {
    generator.lines.push(...scalar)
  } else if (NESTED.has(target.node.kind)) {
    emitNested(generator, target, temp)
  } else {
    generator.calls.push(generator.fallback(target.node))
    generator.lines.push(
      `c[${String(generator.calls.length - ONE)}](w, ${target.value})`,
    )
  }
}

/** Build the generated body; throws where a page refuses generated code. */
function build(generator: Generator): Encode {
  const body = generator.lines.join('\n')
  const source = `const { number: n, struct: s, list: a, calls: c } = h\nreturn (w, v) => {\nconst r = s(v)\n${body}\n}`
  // oxlint-disable-next-line no-new-func, typescript/no-implied-eval, typescript/no-unsafe-type-assertion -- local descriptors, every name and bound a JSON literal (see above)
  const make = new Function('h', source) as (helpers: Helpers) => Encode
  return make({
    number: asNumber,
    struct: asStruct,
    list: asList,
    calls: generator.calls,
  })
}

/** One struct's encoder as a single generated function; undefined under a CSP. */
function generateStructEncoder(
  fields: readonly WireField[],
  fallback: Fallback,
): Encode | undefined {
  const generator: Generator = { lines: [], calls: [], fallback, next: 0 }
  emitFields(generator, fields, 'r')
  try {
    return build(generator)
  } catch (error) {
    if (error instanceof EvalError) {
      return undefined
    }
    throw error
  }
}

export { generateStructEncoder }
