import { WIRE_CLASSES } from './classes.ts'
import { WIRE_EVENTS } from './events.ts'
import { WIRE_MAJOR, WIRE_MINOR } from './major.ts'
import {
  HELLO,
  WELCOME,
  WIRE_ACTS,
  WIRE_COMMAND,
  WIRE_MESSAGES,
  WIRE_RECORDS,
} from './records.ts'
import { v0SchemaHash } from './v0.ts'

import type {
  ColdField,
  ColdRecord,
  WireArm,
  WireClass,
  WireClassField,
  WireField,
  WireLife,
  WireMessage,
  WireNode,
  WireRecord,
} from './grammar.ts'

// WIRE-STABILITY 5.2 and 7: `wire.lock.json` is generated from the
// descriptors, never edited by hand. It lists every id in every space, each
// with `since`, and every field with its resolved default.

const LOCK_VERSION = 1
const JSON_INDENT = 2
const ZERO = 0
/** The changed-field mask is one 32-bit word (`MAX_ROW_FIELDS`). */
const MAX_ROW_FIELDS = 32
/** JSON has no undefined: an absent optional or ref reads as null. */
// oxlint-disable-next-line unicorn/no-null -- the lock is JSON
const ABSENT = null

type Json = string | number | boolean | null | readonly Json[] | JsonObject
interface JsonObject {
  readonly [key: string]: Json
}

function life(entry: WireLife): JsonObject {
  return {
    since: entry.since ?? ZERO,
    ...(entry.deprecated === undefined ? {} : { deprecated: entry.deprecated }),
  }
}

/** A node's typed default: what a receiver reads when the sender lacks it. */
function nodeDefault(node: WireNode): Json {
  switch (node.kind) {
    case 'bool': {
      return false
    }
    case 'quant': {
      return node.min
    }
    case 'enum':
    case 'union': {
      return node.default
    }
    case 'ref':
    case 'optional': {
      return ABSENT
    }
    case 'text': {
      return ''
    }
    case 'array': {
      return []
    }
    case 'struct': {
      return Object.fromEntries(
        node.fields.map((field: WireField): readonly [string, Json] => [
          field.name,
          nodeDefault(field.node),
        ]),
      )
    }
    case 'uint':
    case 'f32':
    case 'f64':
    case 'fixed':
    case 'angle': {
      return ZERO
    }
    default: {
      throw new RangeError('Unknown wire node')
    }
  }
}

/** A node as the lock writes it, fields and arms included. */
function lockNode(node: WireNode): Json {
  switch (node.kind) {
    case 'optional': {
      return { kind: node.kind, node: lockNode(node.node) }
    }
    case 'array': {
      const inner = lockNode(node.node)
      return { kind: node.kind, node: inner, maxCount: node.maxCount }
    }
    case 'struct': {
      // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
      return { kind: node.kind, fields: node.fields.map(lockFieldOf) }
    }
    case 'union': {
      return {
        kind: node.kind,
        bits: node.bits,
        default: node.default,
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        arms: node.arms.map(lockArmOf),
      }
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
      return { ...node }
    }
    default: {
      throw new RangeError('Unknown wire node')
    }
  }
}

function lockField(field: WireField): JsonObject {
  return {
    id: field.id,
    name: field.name,
    node: lockNode(field.node),
    default: nodeDefault(field.node),
    ...life(field),
  }
}
const lockFieldOf = (field: WireField): Json => lockField(field)

function lockArm(arm: WireArm): Json {
  return {
    id: arm.id,
    name: arm.name,
    fields: arm.fields.map(lockFieldOf),
    ...life(arm),
  }
}
const lockArmOf = (arm: WireArm): Json => lockArm(arm)

function lockRecord(record: WireRecord): Json {
  return {
    id: record.id,
    name: record.name,
    fields: record.fields.map(lockFieldOf),
    ...(record.tail === undefined ? {} : { tail: record.tail }),
    ...life(record),
  }
}

function lockColdField(field: ColdField): Json {
  return {
    id: field.id,
    name: field.name,
    wire: field.wire,
    ...(field.holds === undefined ? {} : { holds: field.holds }),
    required: field.required === true,
    repeated: field.repeated === true,
    ...life(field),
  }
}

function lockCold(record: ColdRecord): Json {
  return {
    id: record.id,
    name: record.name,
    fields: record.fields.map((field: ColdField): Json => lockColdField(field)),
    ...life(record),
  }
}

function lockMessage(message: WireMessage): Json {
  return {
    id: message.id,
    name: message.name,
    singleton: message.singleton,
    ...life(message),
  }
}

/** A class's row: the `all` and `others` fields, which the mask covers. */
function rowFieldCount(wireClass: WireClass): number {
  return wireClass.fields.filter(
    (field: WireClassField): boolean =>
      field.predicted !== true &&
      field.node.kind !== 'text' &&
      (field.send === undefined ||
        field.send === 'all' ||
        field.send === 'others'),
  ).length
}

function lockClassField(field: WireClassField): Json {
  return {
    ...lockField(field),
    send: field.send ?? 'all',
    predicted: field.predicted === true,
    required: field.required === true,
  }
}

function lockClass(wireClass: WireClass): Json {
  return {
    id: wireClass.id,
    name: wireClass.name,
    ...(wireClass.relevance === undefined
      ? {}
      : { relevance: wireClass.relevance }),
    rowFields: rowFieldCount(wireClass),
    fields: wireClass.fields.map((field: WireClassField): Json =>
      lockClassField(field),
    ),
    ...life(wireClass),
  }
}

/** The whole lock, as data. */
function wireLock(): Json {
  return {
    version: LOCK_VERSION,
    wireMajor: WIRE_MAJOR,
    wireMinor: WIRE_MINOR,
    maxRowFields: MAX_ROW_FIELDS,
    v0SchemaHash: v0SchemaHash(WIRE_CLASSES),
    messages: WIRE_MESSAGES.map((message: WireMessage): Json =>
      lockMessage(message),
    ),
    cold: [HELLO, WELCOME].map((record: ColdRecord): Json => lockCold(record)),
    records: WIRE_RECORDS.map((record: WireRecord): Json => lockRecord(record)),
    events: WIRE_EVENTS.map((record: WireRecord): Json => lockRecord(record)),
    acts: lockNode(WIRE_ACTS),
    command: lockNode(WIRE_COMMAND),
    classes: WIRE_CLASSES.map((wireClass: WireClass): Json =>
      lockClass(wireClass),
    ),
    capabilities: [],
    rideLaws: [],
    reserved: {
      messages: [],
      events: [],
      acts: [],
      classes: [],
      capabilities: [],
      rideLaws: [],
    },
  }
}

/** The committed text of `wire.lock.json`. */
function wireLockText(): string {
  return `${JSON.stringify(wireLock(), undefined, JSON_INDENT)}\n`
}

export {
  MAX_ROW_FIELDS,
  nodeDefault,
  rowFieldCount,
  wireLock,
  wireLockText,
  type Json,
}
