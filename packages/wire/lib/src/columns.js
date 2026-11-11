import { indexBits } from './bounds.js';
const ONE = 1;
const WORD = 32;
const DOUBLE = 64;
const REF_BITS = 16;
/** A column's width: the bits its quantised word takes. */
function columnBits(node) {
    switch (node.kind) {
        case 'uint':
        case 'quant':
        case 'fixed':
        case 'angle': {
            return node.bits;
        }
        case 'bool': {
            return ONE;
        }
        case 'f32': {
            return WORD;
        }
        case 'f64': {
            return DOUBLE;
        }
        case 'ref': {
            return REF_BITS;
        }
        case 'enum': {
            return indexBits(node.values.length);
        }
        case 'text':
        case 'optional':
        case 'array':
        case 'struct':
        case 'union': {
            throw new RangeError(`A ${node.kind} field has no column`);
        }
        default: {
            throw new RangeError('Unknown wire node');
        }
    }
}
const columnOf = (field) => ({
    id: field.id,
    bits: columnBits(field.node),
    node: field.node,
});
const isText = (field) => field.node.kind === 'text';
const send = (field) => field.send ?? 'all';
const inRow = (field) => field.predicted !== true &&
    !isText(field) &&
    (send(field) === 'all' || send(field) === 'others');
const inOwner = (field) => !isText(field) &&
    (field.predicted === true || send(field) === 'all' || send(field) === 'owner');
const inInitial = (field) => !isText(field) && send(field) === 'initial';
/** The columns of the fields that `keep` keeps, in declared order. */
function pick(fields, keep) {
    const out = [];
    for (const field of fields) {
        if (keep(field)) {
            out.push(columnOf(field));
        }
    }
    return out;
}
/** Compile one class's columns, in its declared order. */
function classColumns(wireClass) {
    const { fields } = wireClass;
    return {
        id: wireClass.id,
        row: pick(fields, inRow),
        owner: pick(fields, inOwner),
        initial: pick(fields, inInitial),
        text: fields
            .filter((field) => isText(field) && send(field) === 'initial')
            .map((field) => field.id),
    };
}
export { classColumns, columnBits };
