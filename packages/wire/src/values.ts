import type { WireArm, WireField, WireNode } from './grammar.ts'

// What a v1 codec reads and writes. A struct is an object keyed by the
// receiver's field names; a union is its arm's name and that arm's fields.
// Absence is not zero (5.3): an absent optional is `undefined`, distinct from
// `false`, `0` and `''`. A ref is a 16-bit handle, 0 for none.

/** One decoded or to-be-encoded value. */
type WireValue =
  | number
  | boolean
  | string
  | undefined
  | readonly WireValue[]
  | WireStruct
/** A struct's fields by name. */
interface WireStruct {
  readonly [name: string]: WireValue
}
/** A union value: the arm's name and its fields. */
interface WireArmValue {
  readonly arm: string
  readonly fields: WireStruct
}

const ZERO = 0

/** Every field of a struct at its default. */
function structDefaults(fields: readonly WireField[]): WireStruct {
  const out: Record<string, WireValue> = {}
  for (const field of fields) {
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    out[field.name] = defaultValue(field.node)
  }
  return out
}

/** What a receiver reads for a field its sender's table lacks. */
function defaultValue(node: WireNode): WireValue {
  switch (node.kind) {
    case 'bool': {
      return false
    }
    case 'quant': {
      return node.min
    }
    case 'enum': {
      return node.default
    }
    case 'text': {
      return ''
    }
    case 'array':
    case 'struct':
    case 'union':
    case 'optional': {
      // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
      return nestedDefault(node)
    }
    case 'uint':
    case 'f32':
    case 'f64':
    case 'fixed':
    case 'angle':
    case 'ref': {
      return ZERO
    }
    default: {
      throw new RangeError('Unknown wire node')
    }
  }
}

/** A nesting node's default: empty, at defaults, the default arm, or absent. */
function nestedDefault(node: WireNode): WireValue {
  if (node.kind === 'array') {
    return []
  }
  if (node.kind === 'struct') {
    return structDefaults(node.fields)
  }
  // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
  return node.kind === 'union' ? unionDefault(node) : undefined
}

/** A union a sender lacks reads as its declared default arm, at defaults. */
function unionDefault(node: Extract<WireNode, { kind: 'union' }>): WireValue {
  const arm = node.arms.find(
    (entry: WireArm): boolean => entry.name === node.default,
  )
  return arm === undefined
    ? undefined
    : { arm: arm.name, fields: structDefaults(arm.fields) }
}

/** A value as a number; anything else is a sender bug. */
function asNumber(value: WireValue): number {
  if (typeof value !== 'number') {
    throw new TypeError(`Expected a number, not ${typeof value}`)
  }
  return value
}

const isStruct = (value: WireValue): value is WireStruct =>
  typeof value === 'object' && !Array.isArray(value)

/** A value as a struct. */
function asStruct(value: WireValue): WireStruct {
  if (!isStruct(value)) {
    throw new TypeError('Expected a struct')
  }
  return value
}

/** A value as a list. */
function asList(value: WireValue): readonly WireValue[] {
  if (!Array.isArray(value)) {
    throw new TypeError('Expected a list')
  }
  return value as readonly WireValue[]
}

/** A value as a union's arm and fields. */
function asArm(value: WireValue): WireArmValue {
  const { arm, fields } = asStruct(value)
  if (typeof arm !== 'string' || !isStruct(fields)) {
    throw new TypeError('Expected an arm and its fields')
  }
  return { arm, fields }
}

export {
  asArm,
  asList,
  asNumber,
  asStruct,
  defaultValue,
  isStruct,
  structDefaults,
  type WireArmValue,
  type WireStruct,
  type WireValue,
}
