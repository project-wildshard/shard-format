import { nodeProblems } from './node-checks.ts'
import { TableReader } from './table-reader.ts'
import { FIRST_CODE, KIND_CODES, unzigzag } from './tables.ts'
import { WireDecodeError } from './wire-error.ts'

import type { WireArm, WireField, WireNode } from './grammar.ts'
import type { TableSource } from './table-reader.ts'

// Read a peer's table block back into nodes. Names are local, so a peer's
// fields and arms are named `#<id>`; a receiver projects onto its own names
// by id. Every node read is checked as a local descriptor is (validate.ts).

type Kind = (typeof KIND_CODES)[number]

const ZERO = 0
const ONE = 1

const label = (id: number): string => `#${String(id)}`

function readKind(reader: TableSource): Kind {
  const kind = KIND_CODES[reader.uvarint() - FIRST_CODE]
  if (kind === undefined) {
    throw new WireDecodeError('A table names a node kind this major lacks')
  }
  return kind
}

function readFields(reader: TableSource, depth: number): readonly WireField[] {
  const count = reader.count()
  const fields: WireField[] = []
  for (let index = ZERO; index < count; index += ONE) {
    const id = reader.uvarint()
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    fields.push({ id, name: label(id), node: readNode(reader, depth + ONE) })
  }
  return fields
}

function readEnum(reader: TableSource): WireNode {
  const count = reader.count()
  const values: string[] = []
  for (let index = ZERO; index < count; index += ONE) {
    values.push(reader.word())
  }
  const fallback = values[reader.uvarint()]
  if (fallback === undefined) {
    throw new WireDecodeError('An enum default is past its values')
  }
  return { kind: 'enum', values, default: fallback }
}

function readUnion(reader: TableSource, depth: number): WireNode {
  const bits = reader.uvarint()
  const fallback = reader.uvarint()
  const count = reader.count()
  const arms: WireArm[] = []
  for (let index = ZERO; index < count; index += ONE) {
    const id = reader.uvarint()
    arms.push({ id, name: label(id), fields: readFields(reader, depth) })
  }
  return { kind: 'union', bits, arms, default: label(fallback) }
}

function readScaled(reader: TableSource, kind: Kind): WireNode | undefined {
  if (kind === 'quant') {
    const min = reader.f64()
    const max = reader.f64()
    return { kind, min, max, bits: reader.uvarint() }
  }
  if (kind === 'fixed') {
    const bits = reader.uvarint()
    const divisor = reader.uvarint()
    return { kind, bits, divisor, offset: unzigzag(reader.uvarint()) }
  }
  return undefined
}

function readLeaf(reader: TableSource, kind: Kind): WireNode | undefined {
  if (kind === 'uint' || kind === 'angle') {
    return { kind, bits: reader.uvarint() }
  }
  if (kind === 'text') {
    return { kind, maxBytes: reader.uvarint() }
  }
  if (kind === 'bool' || kind === 'f32' || kind === 'f64' || kind === 'ref') {
    return { kind }
  }
  return kind === 'enum' ? readEnum(reader) : readScaled(reader, kind)
}

function readNested(reader: TableSource, kind: Kind, depth: number): WireNode {
  if (kind === 'optional') {
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    return { kind, node: readNode(reader, depth + ONE) }
  }
  if (kind === 'array') {
    const maxCount = reader.uvarint()
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    return { kind, maxCount, node: readNode(reader, depth + ONE) }
  }
  if (kind === 'union') {
    return readUnion(reader, depth)
  }
  return { kind: 'struct', fields: readFields(reader, depth) }
}

/** Read one node and everything inside it. */
function readNode(reader: TableSource, depth: number): WireNode {
  reader.tick(depth)
  const kind = readKind(reader)
  return readLeaf(reader, kind) ?? readNested(reader, kind, depth)
}

/** Decode a table block: its top-level entries, each checked whole. */
function decodeTable(
  bytes: Readonly<Uint8Array>,
  start: number,
  end: number,
): readonly WireField[] {
  const reader = new TableReader(bytes, start, end)
  const entries = readFields(reader, ZERO)
  if (!reader.done) {
    throw new WireDecodeError('A table has trailing bytes')
  }
  const problems = nodeProblems('table', { kind: 'struct', fields: entries })
  if (problems.length > ZERO) {
    throw new WireDecodeError(`A table is unsound: ${problems.join('; ')}`)
  }
  return entries
}

export { decodeTable, readNode }
