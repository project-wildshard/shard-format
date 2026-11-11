import { indexBits } from './bounds.ts'

import type { WireClass, WireClassField, WireNode } from './grammar.ts'

// WIRE-STABILITY 5.4: a class's fields split by audience, as engine's v0
// `compileSchema` splits them, so a v1 frame carries the same quantised words
// v0 did: the row (`all` and `others`), the owner block (`all`, `owner` and
// every predicted field, doubles for f64) and the spawn's initial columns.

/** One column: its field id, its bits on the wire, and its node. */
interface Column {
  readonly id: number
  readonly bits: number
  readonly node: WireNode
}
/** A class compiled into its columns. */
interface ClassColumns {
  readonly id: number
  readonly row: readonly Column[]
  readonly owner: readonly Column[]
  readonly initial: readonly Column[]
  readonly text: readonly number[]
}

const ONE = 1
const WORD = 32
const DOUBLE = 64
const REF_BITS = 16

/** A column's width: the bits its quantised word takes. */
function columnBits(node: WireNode): number {
  switch (node.kind) {
    case 'uint':
    case 'quant':
    case 'fixed':
    case 'angle': {
      return node.bits
    }
    case 'bool': {
      return ONE
    }
    case 'f32': {
      return WORD
    }
    case 'f64': {
      return DOUBLE
    }
    case 'ref': {
      return REF_BITS
    }
    case 'enum': {
      return indexBits(node.values.length)
    }
    case 'text':
    case 'optional':
    case 'array':
    case 'struct':
    case 'union': {
      throw new RangeError(`A ${node.kind} field has no column`)
    }
    default: {
      throw new RangeError('Unknown wire node')
    }
  }
}

const columnOf = (field: WireClassField): Column => ({
  id: field.id,
  bits: columnBits(field.node),
  node: field.node,
})
const isText = (field: WireClassField): boolean => field.node.kind === 'text'
const send = (field: WireClassField): string => field.send ?? 'all'
const inRow = (field: WireClassField): boolean =>
  field.predicted !== true &&
  !isText(field) &&
  (send(field) === 'all' || send(field) === 'others')
const inOwner = (field: WireClassField): boolean =>
  !isText(field) &&
  (field.predicted === true || send(field) === 'all' || send(field) === 'owner')
const inInitial = (field: WireClassField): boolean =>
  !isText(field) && send(field) === 'initial'

/** The columns of the fields that `keep` keeps, in declared order. */
function pick(
  fields: readonly WireClassField[],
  keep: (field: WireClassField) => boolean,
): readonly Column[] {
  const out: Column[] = []
  for (const field of fields) {
    if (keep(field)) {
      out.push(columnOf(field))
    }
  }
  return out
}

/** Compile one class's columns, in its declared order. */
function classColumns(wireClass: WireClass): ClassColumns {
  const { fields } = wireClass
  return {
    id: wireClass.id,
    row: pick(fields, inRow),
    owner: pick(fields, inOwner),
    initial: pick(fields, inInitial),
    text: fields
      .filter(
        (field: WireClassField): boolean =>
          isText(field) && send(field) === 'initial',
      )
      .map((field: WireClassField): number => field.id),
  }
}

export { classColumns, columnBits, type ClassColumns, type Column }
