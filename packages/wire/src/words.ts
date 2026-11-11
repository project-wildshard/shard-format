import { WireDecodeError } from './wire-error.ts'

import type { WireNode } from './grammar.ts'

// WIRE-STABILITY 5.4: a frame column holds a quantised word (or, in the owner
// block, an f64's double). When a sender's node for a field differs from the
// receiver's (new bounds, a longer enum), the word is read by the sender's
// node and written by the receiver's: a bounds change is not a binary break.

/** A column word read as a value, and a value written as a word. */
interface WordCodec {
  readonly toValue: (word: number) => number | string
  readonly toWord: (value: number | string) => number
  /** The word of the node's default. */
  readonly fallback: number
}

const ZERO = 0
const ONE = 1
const TWO = 2
const TAU = Math.PI * TWO
const F32_BYTES = 4
const scratch = new DataView(new ArrayBuffer(F32_BYTES))

const numeric = (value: number | string): number =>
  typeof value === 'number' ? value : ZERO
const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high)
const IDENTITY: WordCodec = {
  toValue: (word: number): number => word,
  toWord: numeric,
  fallback: ZERO,
}
const F32: WordCodec = {
  toValue: (word: number): number => {
    scratch.setUint32(ZERO, word)
    return scratch.getFloat32(ZERO)
  },
  toWord: (value: number | string): number => {
    scratch.setFloat32(ZERO, numeric(value))
    return scratch.getUint32(ZERO)
  },
  fallback: ZERO,
}

function quantWords(min: number, max: number, bits: number): WordCodec {
  const step = (max - min) / (TWO ** bits - ONE)
  return {
    toValue: (word: number): number => min + word * step,
    toWord: (value: number | string): number =>
      Math.round((clamp(numeric(value), min, max) - min) / step),
    fallback: ZERO,
  }
}

function angleWords(bits: number): WordCodec {
  const turns = TWO ** bits
  const step = TAU / turns
  return {
    toValue: (word: number): number => word * step,
    toWord: (value: number | string): number =>
      Math.round((((numeric(value) % TAU) + TAU) % TAU) / step) % turns,
    fallback: ZERO,
  }
}

function enumWords(values: readonly string[], fallback: string): WordCodec {
  const index = new Map(
    values.map((word: string, at: number): readonly [string, number] => [
      word,
      at,
    ]),
  )
  const home = index.get(fallback) ?? ZERO
  return {
    toValue: (word: number): string => values[word] ?? fallback,
    toWord: (value: number | string): number =>
      typeof value === 'string' ? (index.get(value) ?? home) : home,
    fallback: home,
  }
}

/** How a column of this node reads and writes its words. */
function wordCodec(node: WireNode): WordCodec {
  switch (node.kind) {
    case 'quant': {
      return quantWords(node.min, node.max, node.bits)
    }
    case 'angle': {
      return angleWords(node.bits)
    }
    case 'enum': {
      return enumWords(node.values, node.default)
    }
    case 'f32': {
      return F32
    }
    case 'uint':
    case 'bool':
    case 'ref':
    case 'f64':
    case 'fixed': {
      return IDENTITY
    }
    case 'text':
    case 'optional':
    case 'array':
    case 'struct':
    case 'union': {
      throw new WireDecodeError(`A ${node.kind} field has no column word`)
    }
    default: {
      throw new WireDecodeError('Unknown wire node')
    }
  }
}

export { wordCodec, type WordCodec }
