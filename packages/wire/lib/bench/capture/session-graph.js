import { array, integer, literal, maxValue, minValue, number, parse, pipe, regex, strictObject, string, unknown, } from 'valibot';
import { Dictionary, expand, nodeOf, MAX_EXPANDED, MAX_NODES, } from './capture-graph.js';
import { sealGraphPart, openGraphPart } from './graph-part.js';
import { ENGINE, parseSession, parseStoredSession } from './session-data.js';
const ZERO = 0;
const ONE = 1;
const TWO = 2;
const THREE = 3;
const HEX = 16;
const MAX_PART = 1_000_000;
const MAX_ARCHIVE = 5_000_000;
const MAX_GRAPH = 20_000_000;
const encoder = new TextEncoder();
const natural = pipe(number(), integer(), minValue(ZERO));
const positive = pipe(natural, minValue(ONE));
const boundedNodes = pipe(positive, maxValue(MAX_NODES));
const hash = pipe(string(), regex(/^[a-f0-9]{64}$/u));
const PartSchema = strictObject({
    file: pipe(string(), regex(/^part-[0-9]{3}\.json$/u)),
    start: natural,
    count: positive,
    bytes: pipe(positive, maxValue(MAX_PART)),
    expandedBytes: pipe(positive, maxValue(MAX_PART)),
    hash,
});
const HeaderSchema = strictObject({
    format: literal('wire-capture-graph/1'),
    engine: literal(ENGINE),
    product: string(),
    ticks: positive,
    root: natural,
    nodes: boundedNodes,
    expandedBytes: pipe(positive, maxValue(MAX_EXPANDED)),
    hash,
    parts: array(PartSchema),
});
function headerOf(value) {
    return parse(HeaderSchema, value);
}
function bytes(value) {
    return encoder.encode(`${JSON.stringify(value)}\n`);
}
async function digest(data) {
    const result = await crypto.subtle.digest('SHA-256', Uint8Array.from(data).buffer);
    return Array.from(new Uint8Array(result), (byte) => byte.toString(HEX).padStart(TWO, '0')).join('');
}
function partName(index) {
    return `part-${String(index).padStart(THREE, '0')}.json`;
}
function budget(header) {
    if (header.parts.length === ZERO ||
        header.parts.reduce((sum, part) => sum + part.expandedBytes, ZERO) > MAX_GRAPH ||
        header.parts.reduce((sum, part) => sum + part.bytes, bytes(header).length) > MAX_ARCHIVE) {
        throw new Error('Capture graph exceeds its archive budget');
    }
}
class PartBuilder {
    pieces = [];
    starts = [];
    counts = [];
    items = [];
    size = THREE;
    start = ZERO;
    flush() {
        if (this.items.length === ZERO) {
            return;
        }
        this.pieces.push(bytes(this.items));
        this.starts.push(this.start);
        this.counts.push(this.items.length);
        this.start += this.items.length;
        this.items = [];
        this.size = THREE;
    }
    add(node) {
        const { length } = bytes(node);
        if (length + THREE > MAX_PART) {
            throw new Error('Capture graph node exceeds its file budget');
        }
        if (this.size + length > MAX_PART) {
            this.flush();
        }
        this.items.push(node);
        this.size += length;
    }
    async seal() {
        this.flush();
        return await Promise.all(this.pieces.map(async (data, index) => {
            const packed = await sealGraphPart(data);
            this.pieces[index] = packed;
            return {
                file: partName(index),
                start: this.starts[index] ?? ZERO,
                count: this.counts[index] ?? ZERO,
                bytes: packed.length,
                expandedBytes: data.length,
                hash: await digest(packed),
            };
        }));
    }
}
function capture(value) {
    const source = parseStoredSession(value);
    const document = bytes(source);
    const dictionary = new Dictionary();
    if (document.length > MAX_EXPANDED) {
        throw new Error('Capture graph exceeds its expanded budget');
    }
    const root = dictionary.put(JSON.parse(new TextDecoder().decode(document)));
    return {
        document,
        dictionary,
        root,
        product: source.product,
        ticks: source.ticks,
    };
}
/** Lossless structural sharing for dense captures; the frozen codec remains unchanged. */
async function archiveGraphSession(value) {
    const source = capture(value);
    const builder = new PartBuilder();
    for (const node of source.dictionary.nodes) {
        builder.add(node);
    }
    const parts = await builder.seal();
    const manifest = {
        format: 'wire-capture-graph/1',
        engine: ENGINE,
        product: source.product,
        ticks: source.ticks,
        root: source.root,
        nodes: source.dictionary.nodes.length,
        expandedBytes: source.document.length,
        hash: await digest(source.document),
        parts,
    };
    budget(manifest);
    const files = new Map(builder.pieces.map((data, index) => [partName(index), data]));
    return { manifest, files };
}
async function readPart(part, read) {
    const data = await read(part.file);
    if (data.length !== part.bytes || (await digest(data)) !== part.hash) {
        throw new Error('Capture graph part bytes differ');
    }
    const expanded = await openGraphPart(data, part.expandedBytes);
    const items = parse(array(unknown()), JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(expanded)));
    if (items.length !== part.count) {
        throw new Error('Capture graph part count differs');
    }
    return items.map((item) => nodeOf(item));
}
function validateParts(header) {
    let count = ZERO;
    for (const [index, part] of header.parts.entries()) {
        if (part.file !== partName(index) ||
            part.start !== count ||
            count + part.count > header.nodes) {
            throw new Error('Capture graph parts must be complete and ordered');
        }
        count += part.count;
    }
    if (count !== header.nodes || header.root !== count - ONE) {
        throw new Error('Capture graph content is incomplete');
    }
}
async function validateContent(header, nodes) {
    const source = expand(nodes, header.root);
    const document = bytes(source);
    if (document.length !== header.expandedBytes ||
        (await digest(document)) !== header.hash) {
        throw new Error('Capture graph expanded content differs');
    }
    const session = parseSession(source);
    if (session.product !== header.product || session.ticks !== header.ticks) {
        throw new Error('Capture graph metadata differs');
    }
    return session;
}
/** Hash, reconstruct and frozen-replay all content before returning a dense session. */
async function readGraphSession(value, read) {
    const header = headerOf(value);
    budget(header);
    validateParts(header);
    const groups = await Promise.all(header.parts.map(async (part) => await readPart(part, read)));
    return await validateContent(header, groups.flat());
}
export { archiveGraphSession, readGraphSession };
