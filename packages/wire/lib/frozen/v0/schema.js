// P1-E5.2 (J4, E5-REPLICATION §3): entity state declares what replicates. Declarations are plain data tables with
// accessors, as Source's SendTables and Unreal's replicated properties are lists; a field no table names stays on the
// server. Each table compiles once into columns; encode and decode are plain loops over those columns.
import { fnv1a32 } from './support.js';
import { bitsToFloat, floatToBits } from './bits.js';
/** Declare a class. Typed as a function so a table's accessors infer `S`. */
export function netSchema(schema) { return schema; }
const TAU = Math.PI * 2;
/** The most row fields a class may declare: the changed-field mask is one 32-bit word. */
export const MAX_ROW_FIELDS = 32;
const clamp = (value, low, high) => value < low ? low : value > high ? high : value;
function column(name, field) {
    const base = { name, kind: field.kind };
    if (field.kind === 'f32q') {
        const span = field.max - field.min, top = 2 ** field.bits - 1, step = span / top;
        return { ...base, bits: field.bits, step,
            sample: view => Math.round((clamp(field.read(view), field.min, field.max) - field.min) / step),
            value: quantised => field.min + quantised * step };
    }
    if (field.kind === 'f32')
        return { ...base, bits: 32, step: 0, sample: view => floatToBits(field.read(view)), value: bitsToFloat };
    if (field.kind === 'f64')
        return { ...base, bits: 64, step: 0, sample: view => field.read(view), value: double => double }; // an owner block holds the double itself
    if (field.kind === 'angle') {
        const turns = 2 ** field.bits, step = TAU / turns;
        return { ...base, bits: field.bits, step,
            sample: view => Math.round((((field.read(view) % TAU) + TAU) % TAU) / step) % turns,
            value: quantised => quantised * step };
    }
    if (field.kind === 'u8' || field.kind === 'u16' || field.kind === 'u32') {
        const bits = field.kind === 'u8' ? 8 : field.kind === 'u16' ? 16 : 32, top = 2 ** bits - 1;
        return { ...base, bits, step: 1, sample: view => clamp(Math.round(field.read(view)), 0, top), value: quantised => quantised };
    }
    if (field.kind === 'bool')
        return { ...base, bits: 1, step: 0, sample: view => field.read(view) ? 1 : 0, value: quantised => quantised === 1 };
    if (field.kind === 'enum') {
        const index = new Map(field.values.map((value, at) => [value, at]));
        return { ...base, bits: Math.max(1, Math.ceil(Math.log2(field.values.length))), step: 0,
            sample: view => {
                const raw = field.read(view), at = index.get(raw);
                if (at === undefined)
                    throw new RangeError(`Undeclared ${name} value ${raw}`);
                return at;
            },
            value: quantised => field.values[quantised] ?? '' };
    }
    if (field.kind === 'ref')
        return { ...base, bits: 16, step: 0, sample: (view, refs) => { const id = field.read(view); return id === null ? 0 : refs(id); }, value: quantised => quantised };
    throw new RangeError(`Text field ${name} has no row form`);
}
/** Compile one declaration, refusing a table the wire cannot carry. */
export function compileSchema(schema, id) {
    const row = [], owner = [], initial = [], text = [];
    for (const [name, field] of Object.entries(schema.fields)) {
        const send = field.send ?? 'all';
        if (field.predicted === true && send !== 'all' && send !== 'owner')
            throw new RangeError(`${schema.cls}.${name}: a predicted field is the owner's`);
        if (field.kind === 'text') {
            if (send !== 'initial')
                throw new RangeError(`${schema.cls}.${name}: text is initial-only`);
            text.push({ name, read: field.read });
            continue;
        }
        if (field.kind === 'f64' && field.predicted !== true && send !== 'owner')
            throw new RangeError(`${schema.cls}.${name}: a double fits only the owner block`);
        const compiled = column(name, field);
        if (send === 'initial') {
            initial.push(compiled);
            continue;
        }
        if (field.predicted === true) {
            owner.push(compiled);
            continue;
        }
        if (send !== 'others')
            owner.push(compiled);
        if (send !== 'owner')
            row.push(compiled);
    }
    if (row.length > MAX_ROW_FIELDS)
        throw new RangeError(`${schema.cls} declares more than ${String(MAX_ROW_FIELDS)} row fields`);
    const at = (name) => row.findIndex(entry => entry.name === name);
    const x = at('x'), y = at('y'), z = at('z');
    return { id, cls: schema.cls, row, owner, initial, text, radius: schema.relevance?.radius ?? null, position: x < 0 || y < 0 || z < 0 ? null : [x, y, z] };
}
/** The canonical text of a declaration: class, field names, kinds, bounds and order. */
function describeSchema(schema) {
    const fields = Object.entries(schema.fields).map(([name, field]) => {
        const bounds = field.kind === 'f32q' ? `${String(field.min)},${String(field.max)},${String(field.bits)}`
            : field.kind === 'angle' ? String(field.bits) : field.kind === 'enum' ? field.values.join(',') : '';
        return `${name}:${field.kind}:${bounds}:${field.send ?? 'all'}:${field.predicted === true ? 'p' : ''}`;
    });
    return `${schema.cls}{${fields.join(';')}}@${String(schema.relevance?.radius ?? '')}`;
}
/** The word NET_SCHEMA_HASH is: FNV-1a over every class's canonical text, so it changes whenever the wire does. */
export function netSchemaHash(descriptions) { return fnv1a32(descriptions.join('|')); }
/** One class's contribution to the hash. */
export function schemaDescription(schema) { return describeSchema(schema); }
