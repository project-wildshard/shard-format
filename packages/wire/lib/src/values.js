const ZERO = 0;
/** Every field of a struct at its default. */
function structDefaults(fields) {
    const out = {};
    for (const field of fields) {
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        out[field.name] = defaultValue(field.node);
    }
    return out;
}
/** What a receiver reads for a field its sender's table lacks. */
function defaultValue(node) {
    switch (node.kind) {
        case 'bool': {
            return false;
        }
        case 'quant': {
            return node.min;
        }
        case 'enum': {
            return node.default;
        }
        case 'text': {
            return '';
        }
        case 'array':
        case 'struct':
        case 'union':
        case 'optional': {
            // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
            return nestedDefault(node);
        }
        case 'uint':
        case 'f32':
        case 'f64':
        case 'fixed':
        case 'angle':
        case 'ref': {
            return ZERO;
        }
        default: {
            throw new RangeError('Unknown wire node');
        }
    }
}
/** A nesting node's default: empty, at defaults, the default arm, or absent. */
function nestedDefault(node) {
    if (node.kind === 'array') {
        return [];
    }
    if (node.kind === 'struct') {
        return structDefaults(node.fields);
    }
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    return node.kind === 'union' ? unionDefault(node) : undefined;
}
/** A union a sender lacks reads as its declared default arm, at defaults. */
function unionDefault(node) {
    const arm = node.arms.find((entry) => entry.name === node.default);
    return arm === undefined
        ? undefined
        : { arm: arm.name, fields: structDefaults(arm.fields) };
}
/** A value as a number; anything else is a sender bug. */
function asNumber(value) {
    if (typeof value !== 'number') {
        throw new TypeError(`Expected a number, not ${typeof value}`);
    }
    return value;
}
const isStruct = (value) => typeof value === 'object' && !Array.isArray(value);
/** A value as a struct. */
function asStruct(value) {
    if (!isStruct(value)) {
        throw new TypeError('Expected a struct');
    }
    return value;
}
/** A value as a list. */
function asList(value) {
    if (!Array.isArray(value)) {
        throw new TypeError('Expected a list');
    }
    return value;
}
/** A value as a union's arm and fields. */
function asArm(value) {
    const { arm, fields } = asStruct(value);
    if (typeof arm !== 'string' || !isStruct(fields)) {
        throw new TypeError('Expected an arm and its fields');
    }
    return { arm, fields };
}
export { asArm, asList, asNumber, asStruct, defaultValue, isStruct, structDefaults, };
