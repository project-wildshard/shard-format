import { MAX_ROW_FIELDS, rowFieldCount } from './lock.ts'
import { checkFields, checkNode, checkSpace } from './node-checks.ts'

import type {
  ColdRecord,
  WireArm,
  WireClass,
  WireClassField,
  WireField,
  WireNode,
  WireRecord,
} from './grammar.ts'
import type { Identified } from './node-checks.ts'

// WIRE-STABILITY 5.2: ids are positive, unique within their space, and every
// node is bounded with a typed default. WR6 adds the release-diff rules.

/** A descriptor set: everything one wire major declares. */
interface DescriptorSet {
  readonly messages: readonly Identified[]
  readonly cold: readonly ColdRecord[]
  readonly records: readonly WireRecord[]
  readonly events: readonly WireRecord[]
  readonly acts: WireNode
  readonly command: WireNode
  readonly classes: readonly WireClass[]
}

/** The node kinds a class field may be: a column word, or spawn text. */
const CLASS_KINDS: ReadonlySet<string> = new Set([
  'uint',
  'bool',
  'f32',
  'f64',
  'quant',
  'fixed',
  'angle',
  'enum',
  'ref',
  'text',
])

function checkClassField(
  where: string,
  field: WireClassField,
): readonly string[] {
  const at = `${where}.${field.name}`
  const { kind } = field.node
  const owned = field.predicted === true || field.send === 'owner'
  return [
    ...(CLASS_KINDS.has(kind) ? [] : [`${at}: a ${kind} is not a column`]),
    ...(kind === 'text' && field.send !== 'initial'
      ? [`${at}: text is initial-only`]
      : []),
    ...(kind === 'f64' && !owned
      ? [`${at}: a double fits only the owner block`]
      : []),
  ]
}

function checkClass(wireClass: WireClass): readonly string[] {
  const where = `class.${wireClass.name}`
  return [
    ...checkFields(where, wireClass.fields),
    ...(rowFieldCount(wireClass) > MAX_ROW_FIELDS
      ? [`${where}: more than 32 row fields`]
      : []),
    ...wireClass.fields.flatMap((field: WireClassField): readonly string[] =>
      checkClassField(where, field),
    ),
  ]
}

/**
 * Each message tag has exactly one body: a cold record (hello, welcome) or a
 * record, with the same id and name, and no two bodies share an id.
 */
function checkMessageBodies(set: DescriptorSet): readonly string[] {
  const bodies: readonly Identified[] = [...set.cold, ...set.records]
  const unmatched = [
    ...set.messages.filter(
      (message: Identified): boolean =>
        !bodies.some(
          (body: Identified): boolean =>
            body.id === message.id && body.name === message.name,
        ),
    ),
    ...bodies.filter(
      (body: Identified): boolean =>
        !set.messages.some(
          (message: Identified): boolean =>
            body.id === message.id && body.name === message.name,
        ),
    ),
  ]
  return [
    ...checkSpace('message bodies', bodies),
    ...unmatched.map(
      (entry: Identified): string =>
        `messages.${entry.name}: tag ${String(entry.id)} has no matching body`,
    ),
  ]
}

/** Everything wrong with a descriptor set; empty when it is sound. */
function validateDescriptors(set: DescriptorSet): readonly string[] {
  return [
    ...checkSpace('messages', set.messages),
    ...checkMessageBodies(set),
    ...checkSpace('events', set.events),
    ...checkSpace('classes', set.classes),
    ...set.cold.flatMap((record: ColdRecord): readonly string[] =>
      checkSpace(`cold.${record.name}`, record.fields),
    ),
    ...[...set.records, ...set.events].flatMap(
      (record: WireRecord): readonly string[] =>
        checkFields(`record.${record.name}`, record.fields),
    ),
    ...checkNode('acts', set.acts),
    ...checkNode('command', set.command),
    ...set.classes.flatMap((wireClass: WireClass): readonly string[] =>
      checkClass(wireClass),
    ),
  ]
}

/** Everything wrong with one class, as a peer's class table must be checked. */
function classProblems(wireClass: WireClass): readonly string[] {
  return checkClass(wireClass)
}

/** Every ride law's words are f32s, so a frame carries them as v0 did. */
function rideLawProblems(laws: readonly WireArm[]): readonly string[] {
  return [
    ...checkSpace('rideLaws', laws),
    ...laws.flatMap((law: WireArm): readonly string[] => [
      ...checkFields(`rideLaw.${law.name}`, law.fields),
      ...law.fields
        .filter((field: WireField): boolean => field.node.kind !== 'f32')
        .map(
          (field: WireField): string =>
            `rideLaw.${law.name}.${field.name}: a ride word is an f32`,
        ),
    ]),
  ]
}

export {
  classProblems,
  rideLawProblems,
  validateDescriptors,
  type DescriptorSet,
}
