import { NET_EVENT_FORMS } from '../frozen/v0/messages.ts'
import { netSchemaHash, schemaDescription } from '../frozen/v0/schema.ts'
import { v0Field } from './v0-field.ts'

import type { NetField, NetSchema } from '../frozen/v0/schema.ts'
import type { WireClass } from './grammar.ts'

// The v0 canonical text and NET_SCHEMA_HASH of v1 class descriptors, through
// the frozen v0 describer itself (WR2). Engine binds the same forms.

function unbound(): never {
  throw new Error('A v0 description reads no values')
}

/** A v0 declaration with no accessors, for its canonical description. */
function v0Schema(wireClass: WireClass): NetSchema<never> {
  const fields: Record<string, NetField<never>> = {}
  for (const field of wireClass.fields) {
    // A spec and an accessor that never runs make a v0 declaration.
    fields[field.name] = { ...v0Field(field), read: unbound }
  }
  return {
    cls: wireClass.name,
    fields,
    ...(wireClass.relevance === undefined
      ? {}
      : { relevance: { radius: wireClass.relevance } }),
  }
}

/** One class's v0 canonical text, as engine's `schemaDescription` writes it. */
function v0Description(wireClass: WireClass): string {
  return schemaDescription(v0Schema(wireClass))
}

/** Engine's `NET_SCHEMA_HASH` for these classes over the frozen v0 events. */
function v0SchemaHash(classes: readonly WireClass[]): number {
  return netSchemaHash([
    ...classes.map((wireClass: WireClass): string => v0Description(wireClass)),
    NET_EVENT_FORMS,
  ])
}

export { v0Description, v0SchemaHash }
