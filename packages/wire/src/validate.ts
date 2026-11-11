import { MAX_ROW_FIELDS, rowFieldCount } from './lock.ts'
import { checkFields, checkNode, checkSpace } from './node-checks.ts'

import type {
  ColdRecord,
  WireClass,
  WireClassField,
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

function checkClassField(
  where: string,
  field: WireClassField,
): readonly string[] {
  return field.node.kind === 'text' && field.send !== 'initial'
    ? [`${where}.${field.name}: text is initial-only`]
    : []
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

export { validateDescriptors, type DescriptorSet }
