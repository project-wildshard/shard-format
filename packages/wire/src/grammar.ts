// WIRE-STABILITY 5.3: the closed recursive grammar of wire major 1. Every
// node has a typed default and a bounded size, so a receiver can skip what it
// has no slot for. Adding a node kind is a major; adding a field, arm, record,
// class or enum value is a minor. Codecs for these nodes arrive in WR3/WR4.

/** An unsigned integer of 1 to 32 bits. */
interface UintNode {
  readonly kind: 'uint'
  readonly bits: number
}
/** One bit. */
interface BoolNode {
  readonly kind: 'bool'
}
/** IEEE 754 bits, exact. */
interface FloatNode {
  readonly kind: 'f32' | 'f64'
}
/** `round((v - min) / step)` with `step = (max - min) / (2^bits - 1)`. */
interface QuantNode {
  readonly kind: 'quant'
  readonly min: number
  readonly max: number
  readonly bits: number
}
/** `round(v * divisor) - offset`: the steer axes, which quant cannot hit. */
interface FixedNode {
  readonly kind: 'fixed'
  readonly bits: number
  readonly divisor: number
  readonly offset: number
}
/** Turns of `2π / 2^bits`. */
interface AngleNode {
  readonly kind: 'angle'
  readonly bits: number
}
/** One of `values`, mapped by string at the receiver; unknown reads `default`. */
interface EnumNode {
  readonly kind: 'enum'
  readonly values: readonly string[]
  readonly default: string
}
/** A 16-bit net handle, 0 for none. */
interface RefNode {
  readonly kind: 'ref'
}
/** An 8-bit byte length, then UTF-8. */
interface TextNode {
  readonly kind: 'text'
  readonly maxBytes: number
}
/** A presence bit, then the node. */
interface OptionalNode {
  readonly kind: 'optional'
  readonly node: WireNode
}
/** A count in `ceil(log2(maxCount + 1))` bits, then the nodes. */
interface ArrayNode {
  readonly kind: 'array'
  readonly node: WireNode
  readonly maxCount: number
}
/** Fields in the sender's declared order. */
interface StructNode {
  readonly kind: 'struct'
  readonly fields: readonly WireField[]
}
/** An arm id in `bits`, then that arm's struct. */
interface UnionNode {
  readonly kind: 'union'
  readonly bits: number
  readonly arms: readonly WireArm[]
  readonly default: string
}
type WireNode =
  | UintNode
  | BoolNode
  | FloatNode
  | QuantNode
  | FixedNode
  | AngleNode
  | EnumNode
  | RefNode
  | TextNode
  | OptionalNode
  | ArrayNode
  | StructNode
  | UnionNode

/** The release a descriptor appeared in, and the one that deprecated it. */
interface WireLife {
  /** The wire minor this id first shipped in; absent means 0. */
  readonly since?: number
  /** The wire minor that deprecated it; it is still sent until removed. */
  readonly deprecated?: number
}
/** A struct field: its identity is `id`, never its name or position. */
interface WireField extends WireLife {
  readonly id: number
  readonly name: string
  readonly node: WireNode
}
/** A union arm: an act, by its act tag. */
interface WireArm extends WireLife {
  readonly id: number
  readonly name: string
  readonly fields: readonly WireField[]
}

/** Who receives an entity field. `initial` goes once, in the spawn. */
type WireSend = 'all' | 'owner' | 'others' | 'initial'
/** An entity class field: a row, owner or initial column, or spawn text. */
interface WireClassField extends WireField {
  readonly send?: WireSend
  /** The owner predicts it: exact in the owner block (J140). */
  readonly predicted?: true
  /** A receiver cannot run without it: a sender lacking it refuses (5.4). */
  readonly required?: true
}
/** An entity class, replicated as rows against its table (5.4). */
interface WireClass extends WireLife {
  readonly id: number
  readonly name: string
  /** Metres from the receiver's player; absent means the whole cell. */
  readonly relevance?: number
  readonly fields: readonly WireClassField[]
}

/** A tagged, length-prefixed record body in a message or `events` (5.1). */
interface WireRecord extends WireLife {
  readonly id: number
  readonly name: string
  readonly fields: readonly WireField[]
  /**
   * What follows the fields: a spawn's class initial and text columns, a
   * frame's owner block, ride and rows (5.4), or nested event records.
   */
  readonly tail?: 'class-columns' | 'snapshot' | 'records'
}

/** Protobuf-style cold wire types for hello and welcome (5.1). */
type ColdWireType = 'uvarint' | 'fixed32' | 'fixed64' | 'bytes'
/** A cold field: `key = id << 3 | wireType`, skipped by its wire type. */
interface ColdField extends WireLife {
  readonly id: number
  readonly name: string
  readonly wire: ColdWireType
  /** What the bytes hold: text, a table block, or packed ids. */
  readonly holds?: 'text' | 'tables' | 'ids'
  readonly required?: true
  readonly repeated?: true
}
/** A cold record: hello or welcome. */
interface ColdRecord extends WireLife {
  readonly id: number
  readonly name: string
  readonly fields: readonly ColdField[]
}
/** A top-level message tag. */
interface WireMessage extends WireLife {
  readonly id: number
  readonly name: string
  /** Appears at most once per message (5.1). */
  readonly singleton: boolean
}

/** What a field reads as at the receiver once decoded. */
type NodeValue<Node extends WireNode> = Node extends BoolNode
  ? boolean
  : Node extends {
        readonly kind: 'enum'
        readonly values: readonly (infer Value)[]
      }
    ? Value
    : Node extends RefNode
      ? string | null
      : Node extends TextNode
        ? string
        : number

/**
 * Engine's accessors for one class: exactly one per declared field, so a
 * descriptor without a binding fails the engine typecheck (WR2).
 */
type ClassBindings<Class extends WireClass, View> = {
  readonly [Field in Class['fields'][number] as Field['name']]: (
    view: View,
  ) => NodeValue<Field['node']>
}

export type {
  AngleNode,
  ArrayNode,
  BoolNode,
  ClassBindings,
  ColdField,
  ColdRecord,
  ColdWireType,
  EnumNode,
  FixedNode,
  FloatNode,
  NodeValue,
  OptionalNode,
  QuantNode,
  RefNode,
  StructNode,
  TextNode,
  UintNode,
  UnionNode,
  WireArm,
  WireClass,
  WireClassField,
  WireField,
  WireLife,
  WireMessage,
  WireNode,
  WireRecord,
  WireSend,
}
