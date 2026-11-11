import type { WireArm, WireField, WireNode } from './grammar.ts'

// WIRE-STABILITY 5.2 and 5.3: what makes one node sound. Ids are positive and
// unique in their space; every node is bounded, so a skip is a bounded decode
// and a peer's table can never turn a few bytes into unbounded work.

const MIN_ID = 1
const MIN_BITS = 1
const MAX_BITS = 32
const MIN_TEXT_BYTES = 1
const MAX_TEXT_BYTES = 255
const NONE = 0
const BYTE = 8
const MAX_ARRAY = 255
const ONE = 1
const TWO = 2

interface Identified {
  readonly id: number
  readonly name: string
}
/** Ids that are not positive integers, or that repeat in one space. */
function checkSpace(
  space: string,
  entries: readonly Identified[],
): readonly string[] {
  const seen = new Map<number, string>()
  const problems: string[] = []
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.id) || entry.id < MIN_ID) {
      problems.push(`${space}.${entry.name}: id ${String(entry.id)} is not > 0`)
    }
    const other = seen.get(entry.id)
    if (other !== undefined) {
      problems.push(
        `${space}: id ${String(entry.id)} is both ${other} and ${entry.name}`,
      )
    }
    seen.set(entry.id, entry.name)
  }
  return problems
}

function checkBits(where: string, bits: number): readonly string[] {
  return Number.isInteger(bits) && bits >= MIN_BITS && bits <= MAX_BITS
    ? []
    : [`${where}: ${String(bits)} bits is outside 1 to 32`]
}

function checkEnum(
  where: string,
  node: Extract<WireNode, { readonly kind: 'enum' }>,
): readonly string[] {
  const distinct =
    node.values.length > NONE &&
    new Set(node.values).size === node.values.length
  return [
    ...(distinct ? [] : [`${where}: enum values must be present and distinct`]),
    ...(node.values.includes(node.default)
      ? []
      : [`${where}: default ${node.default} is not a declared value`]),
  ]
}

function checkText(where: string, maxBytes: number): readonly string[] {
  return maxBytes >= MIN_TEXT_BYTES && maxBytes <= MAX_TEXT_BYTES
    ? []
    : [`${where}: text holds 1 to 255 bytes`]
}

/** A quant's bounds are finite, and so is its step, which is positive. */
function checkQuant(
  where: string,
  node: Extract<WireNode, { kind: 'quant' }>,
): readonly string[] {
  const step = (node.max - node.min) / (TWO ** node.bits - ONE)
  return Number.isFinite(node.min) &&
    Number.isFinite(node.max) &&
    Number.isFinite(step) &&
    step > NONE
    ? []
    : [`${where}: quant needs finite bounds and a finite positive step`]
}

/** A fixed node divides by a positive integer and offsets by an integer. */
function checkFixed(
  where: string,
  node: Extract<WireNode, { kind: 'fixed' }>,
): readonly string[] {
  return Number.isSafeInteger(node.divisor) &&
    node.divisor >= ONE &&
    Number.isSafeInteger(node.offset)
    ? []
    : [
        `${where}: fixed needs an integer divisor of 1 or more and an integer offset`,
      ]
}

/** The fewest bits a value of this node takes. */
function minBits(node: WireNode): number {
  switch (node.kind) {
    case 'uint':
    case 'quant':
    case 'fixed':
    case 'angle':
    case 'union': {
      return node.bits
    }
    case 'bool':
    case 'optional':
    case 'enum':
    case 'array': {
      return ONE
    }
    case 'f32':
    case 'text':
    case 'ref': {
      return BYTE
    }
    case 'f64': {
      return BYTE
    }
    case 'struct': {
      return node.fields.reduce(
        (sum: number, field: WireField): number => sum + minBits(field.node),
        NONE,
      )
    }
    default: {
      throw new RangeError('Unknown wire node')
    }
  }
}

/** An array holds 1 to 255 values, each at least one bit, so a body bounds its count. */
function checkArray(
  where: string,
  node: Extract<WireNode, { kind: 'array' }>,
): readonly string[] {
  const counted =
    Number.isSafeInteger(node.maxCount) &&
    node.maxCount >= ONE &&
    node.maxCount <= MAX_ARRAY
  return [
    ...(counted ? [] : [`${where}: an array holds 1 to 255 values`]),
    ...(minBits(node.node) >= ONE
      ? []
      : [`${where}: an array's value takes no bits`]),
  ]
}

function checkLeaf(where: string, node: WireNode): readonly string[] {
  switch (node.kind) {
    case 'uint':
    case 'angle':
    case 'union': {
      return checkBits(where, node.bits)
    }
    case 'fixed': {
      return [...checkBits(where, node.bits), ...checkFixed(where, node)]
    }
    case 'quant': {
      return [...checkBits(where, node.bits), ...checkQuant(where, node)]
    }
    case 'enum': {
      return checkEnum(where, node)
    }
    case 'text': {
      return checkText(where, node.maxBytes)
    }
    case 'array': {
      return checkArray(where, node)
    }
    case 'f32':
    case 'f64':
    case 'bool':
    case 'ref':
    case 'optional':
    case 'struct': {
      return []
    }
    default: {
      throw new RangeError('Unknown wire node')
    }
  }
}

/** The fields of a struct, record or arm: their ids, then each node. */
function checkFields(
  where: string,
  fields: readonly WireField[],
): readonly string[] {
  const problems = [...checkSpace(where, fields)]
  for (const field of fields) {
    const at = `${where}.${field.name}`
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    problems.push(...checkNode(at, field.node))
    // A field of no bits lets a few body bits expand into unbounded work.
    if (minBits(field.node) < ONE) {
      problems.push(`${at}: a field takes no bits`)
    }
  }
  return problems
}

function checkUnion(
  where: string,
  node: Extract<WireNode, { readonly kind: 'union' }>,
): readonly string[] {
  const named = node.arms.some(
    (arm: WireArm): boolean => arm.name === node.default,
  )
  const top = TWO ** node.bits - ONE
  const wide = node.arms
    .filter((arm: WireArm): boolean => arm.id > top)
    .map(
      (arm: WireArm): string =>
        `${where}.${arm.name}: arm id ${String(arm.id)} needs more than ${String(node.bits)} bits`,
    )
  return [
    ...checkSpace(where, node.arms),
    ...wide,
    ...node.arms.flatMap((arm: WireArm): readonly string[] =>
      checkFields(`${where}.${arm.name}`, arm.fields),
    ),
    ...(named ? [] : [`${where}: default arm ${node.default} is not declared`]),
  ]
}

/** One node and everything inside it. */
function checkNode(where: string, node: WireNode): readonly string[] {
  // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
  return [...checkLeaf(where, node), ...checkInner(where, node)]
}

/** What a node holds: an inner node, fields or arms. */
function checkInner(where: string, node: WireNode): readonly string[] {
  switch (node.kind) {
    case 'optional':
    case 'array': {
      return checkNode(`${where}[]`, node.node)
    }
    case 'struct': {
      return checkFields(where, node.fields)
    }
    case 'union': {
      return checkUnion(where, node)
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
      return []
    }
    default: {
      throw new RangeError('Unknown wire node')
    }
  }
}

/** Everything wrong with one node, as a peer's table must be checked. */
function nodeProblems(where: string, node: WireNode): readonly string[] {
  return checkNode(where, node)
}

export { checkFields, checkNode, checkSpace, nodeProblems, type Identified }
