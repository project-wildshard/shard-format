import assert from 'node:assert/strict'
import { test } from 'node:test'

import { bitSink } from '../src/bits.ts'
import { compileEncoder } from '../src/encode.ts'
import { WIRE_EVENTS } from '../src/events.ts'
import { localBodyNode, TAG_ACT, TAG_CMDS } from '../src/game.ts'

import type { Encode } from '../src/encode.ts'
import type { WireField, WireNode, WireRecord } from '../src/grammar.ts'
import type { WireValue } from '../src/values.ts'

// WB2: a struct's encoder is generated as one function; where a page
// refuses generated code (a CSP), the closure loop stands in. Both must write
// the same bits for every value, clamps, NaN and refusals included.

type Random = () => number

/** A small seeded generator, so a failure replays. */
function seeded(seed: number): Random {
  let state = seed
  return (): number => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
}

const NUMBERS = [0, -0, 1, -1, 0.5, 2.5, 1e9, -1e9, Number.NaN, 7, 300, 65_536]
const TEXTS = ['', 'a', 'héllo', 'stone-wall']

function pick<Item>(items: readonly Item[], random: Random): Item {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined) {
    throw new Error('Nothing to pick from')
  }
  return item
}

/** A random number, sometimes out of every range. */
const numberFor = (random: Random): number =>
  random() < 0.6 ? pick(NUMBERS, random) : random() * 1000 - 500

/** A random value for a nesting node. */
function nestedFor(node: WireNode, random: Random): WireValue {
  switch (node.kind) {
    case 'optional': {
      // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
      return random() < 0.4 ? undefined : valueFor(node.node, random)
    }
    case 'array': {
      const length = Math.floor(random() * Math.min(node.maxCount, 3) + 1)
      return Array.from(
        { length },
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        (): WireValue => valueFor(node.node, random),
      )
    }
    case 'struct': {
      // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
      return structFor(node.fields, random)
    }
    case 'union': {
      const arm = pick(node.arms, random)
      // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
      return { arm: arm.name, fields: structFor(arm.fields, random) }
    }
    case 'uint':
    case 'bool':
    case 'f32':
    case 'f64':
    case 'quant':
    case 'fixed':
    case 'angle':
    case 'enum':
    case 'ref':
    case 'text': {
      return undefined
    }
    default: {
      throw new RangeError('Unknown wire node')
    }
  }
}

/** A random value for `node`, sometimes out of range. */
function valueFor(node: WireNode, random: Random): WireValue {
  if (node.kind === 'bool') {
    return random() < 0.5
  }
  if (node.kind === 'enum') {
    return pick(node.values, random)
  }
  if (node.kind === 'text') {
    return pick(TEXTS, random)
  }
  return ['optional', 'array', 'struct', 'union'].includes(node.kind)
    ? nestedFor(node, random)
    : numberFor(random)
}

function structFor(fields: readonly WireField[], random: Random): WireValue {
  return Object.fromEntries(
    fields.map((field: WireField): readonly [string, WireValue] => [
      field.name,
      valueFor(field.node, random),
    ]),
  )
}

/** The bytes one encoder writes, or the error it throws. */
function bytesOf(encode: Encode, value: WireValue): string {
  const sink = bitSink()
  try {
    encode(sink, value)
  } catch (error) {
    sink.take()
    return error instanceof Error
      ? `throws ${error.name}: ${error.message}`
      : 'throws'
  }
  return Buffer.from(sink.take()).toString('hex')
}

/** The `Function` a strict CSP leaves a page: it refuses every string. */
function refused(): never {
  throw new EvalError('Refused to evaluate a string as JavaScript')
}

/** Compile with `Function` refused, as a strict CSP refuses it. */
function closureEncoder(node: WireNode): Encode {
  const original = globalThis.Function
  Reflect.set(globalThis, 'Function', refused)
  try {
    return compileEncoder(node)
  } finally {
    Reflect.set(globalThis, 'Function', original)
  }
}

const NODES: readonly (readonly [string, WireNode])[] = [
  ['cmds', localBodyNode(TAG_CMDS)],
  ['act', localBodyNode(TAG_ACT)],
  ...WIRE_EVENTS.map((record: WireRecord): readonly [string, WireNode] => [
    record.name,
    { kind: 'struct', fields: record.fields },
  ]),
]

test('the generated encoder writes the closure encoder bits for every record', (): void => {
  const random = seeded(20_261_111)
  for (const [name, node] of NODES) {
    const generated = compileEncoder(node)
    const closure = closureEncoder(node)
    assert.notEqual(generated.toString(), closure.toString(), name)
    for (let round = 0; round < 200; round += 1) {
      const value = valueFor(node, random)
      assert.equal(
        bytesOf(generated, value),
        bytesOf(closure, value),
        `${name} round ${String(round)}`,
      )
    }
  }
})

test('an over-long array refuses the same way on both paths', (): void => {
  const node: WireNode = {
    kind: 'struct',
    fields: [
      {
        id: 1,
        name: 'list',
        node: { kind: 'array', node: { kind: 'bool' }, maxCount: 2 },
      },
    ],
  }
  const value = { list: [true, false, true] }
  assert.equal(
    bytesOf(compileEncoder(node), value),
    'throws RangeError: An array holds at most 2 values',
  )
  assert.equal(
    bytesOf(compileEncoder(node), value),
    bytesOf(closureEncoder(node), value),
  )
})
