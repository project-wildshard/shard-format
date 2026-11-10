import { array, boolean, finite, integer, literal, minValue, null_, number, parse, pipe, string, tuple, union, } from 'valibot';
const ZERO = 0;
const ONE = 1;
const TWO = 2;
const MAX_EXPANDED = 100_000_000;
const MAX_NODES = 500_000;
const encoder = new TextEncoder();
const natural = pipe(number(), integer(), minValue(ZERO));
const scalar = union([null_(), boolean(), pipe(number(), finite()), string()]);
const referencePair = tuple([natural, natural]);
const NodeSchema = union([
    tuple([literal(ZERO), scalar]),
    tuple([literal(ONE), array(natural)]),
    tuple([literal(TWO), array(referencePair)]),
]);
function nodeOf(value) {
    return parse(NodeSchema, value);
}
function bytes(value) {
    return encoder.encode(`${JSON.stringify(value)}\n`);
}
class Dictionary {
    nodes = [];
    keys = new Map();
    node(value) {
        if (Array.isArray(value)) {
            return [ONE, value.map((item) => this.put(item))];
        }
        if (value !== null && typeof value === 'object') {
            return [
                TWO,
                Object.entries(value).map(([key, item]) => [this.put(key), this.put(item)]),
            ];
        }
        return [ZERO, parse(scalar, value)];
    }
    put(value) {
        return this.retain(this.node(value));
    }
    retain(node) {
        const key = JSON.stringify(node);
        const previous = this.keys.get(key);
        if (previous !== undefined) {
            return previous;
        }
        const index = this.nodes.length;
        if (index >= MAX_NODES) {
            throw new Error('Capture graph exceeds its node budget');
        }
        this.nodes.push(node);
        this.keys.set(key, index);
        return index;
    }
}
const MAX_DEPTH = 64;
function checked(size, depth) {
    if (size > MAX_EXPANDED || depth > MAX_DEPTH) {
        throw new Error('Capture graph exceeds its expansion budget');
    }
    return { size, depth };
}
function readRef(values, id) {
    const value = values[id];
    if (value === undefined) {
        throw new Error('Capture graph has a forward or missing reference');
    }
    return value;
}
function arraySize(ids, sizes) {
    let size = TWO + Math.max(ZERO, ids.length - ONE);
    let depth = ONE;
    for (const id of ids) {
        const entry = readRef(sizes, id);
        size += entry.size;
        depth = Math.max(depth, entry.depth + ONE);
    }
    return checked(size, depth);
}
function objectKey(nodes, id) {
    const key = readRef(nodes, id);
    if (key[ZERO] !== ZERO || typeof key[ONE] !== 'string') {
        throw new Error('Capture graph has an invalid object key');
    }
    return key[ONE];
}
function objectSize(ids, sizes, nodes) {
    const keys = new Set(), measure = { size: TWO + Math.max(ZERO, ids.length - ONE), depth: ONE };
    for (const [keyId, valueId] of ids) {
        const keySize = readRef(sizes, keyId);
        const item = readRef(sizes, valueId);
        const key = objectKey(nodes, keyId);
        if (keys.has(key)) {
            throw new Error('Capture graph has a repeated object key');
        }
        keys.add(key);
        Object.assign(measure, {
            size: measure.size + keySize.size + ONE + item.size,
            depth: Math.max(measure.depth, item.depth + ONE),
        });
    }
    return checked(measure.size, measure.depth);
}
function validateGraph(nodes, root) {
    const sizes = [];
    for (const node of nodes) {
        if (node[ZERO] === ZERO) {
            sizes.push(checked(bytes(node[ONE]).length - ONE, ZERO));
        }
        else if (node[ZERO] === ONE) {
            sizes.push(arraySize(node[ONE], sizes));
        }
        else {
            sizes.push(objectSize(node[ONE], sizes, nodes));
        }
    }
    readRef(sizes, root);
}
function objectValue(ids, values, nodes) {
    const object = {};
    for (const [keyId, valueId] of ids) {
        Object.defineProperty(object, objectKey(nodes, keyId), {
            value: readRef(values, valueId),
            enumerable: true,
        });
    }
    return object;
}
/** Validate every reference and expansion bound before constructing any output container. */
function expand(nodes, root) {
    validateGraph(nodes, root);
    const values = [];
    for (const node of nodes) {
        if (node[ZERO] === ZERO) {
            values.push(node[ONE]);
        }
        else if (node[ZERO] === ONE) {
            values.push(node[ONE].map((id) => readRef(values, id)));
        }
        else {
            values.push(objectValue(node[ONE], values, nodes));
        }
    }
    return readRef(values, root);
}
export { Dictionary, expand, nodeOf, MAX_EXPANDED, MAX_NODES };
