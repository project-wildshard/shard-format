import { NET_EVENT_FORMS } from '../frozen/v0/messages.js';
import { netSchemaHash, schemaDescription } from '../frozen/v0/schema.js';
import { v0Field } from './v0-field.js';
// The v0 canonical text and NET_SCHEMA_HASH of v1 class descriptors, through
// the frozen v0 describer itself (WR2). Engine binds the same forms.
function unbound() {
    throw new Error('A v0 description reads no values');
}
/** A v0 declaration with no accessors, for its canonical description. */
function v0Schema(wireClass) {
    const fields = {};
    for (const field of wireClass.fields) {
        // A spec and an accessor that never runs make a v0 declaration.
        fields[field.name] = { ...v0Field(field), read: unbound };
    }
    return {
        cls: wireClass.name,
        fields,
        ...(wireClass.relevance === undefined
            ? {}
            : { relevance: { radius: wireClass.relevance } }),
    };
}
/** One class's v0 canonical text, as engine's `schemaDescription` writes it. */
function v0Description(wireClass) {
    return schemaDescription(v0Schema(wireClass));
}
/** Engine's `NET_SCHEMA_HASH` for these classes over the frozen v0 events. */
function v0SchemaHash(classes) {
    return netSchemaHash([
        ...classes.map((wireClass) => v0Description(wireClass)),
        NET_EVENT_FORMS,
    ]);
}
export { v0Description, v0SchemaHash };
