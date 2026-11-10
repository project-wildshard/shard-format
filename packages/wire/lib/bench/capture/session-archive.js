import { array, literal, maxValue, minLength, minValue, number, integer, parse, picklist, pipe, regex, strictObject, string, unknown, } from 'valibot';
import { VERSION, ENGINE, parseStoredSession, parseSession, } from './session-data.js';
const MAX_BYTES = 1_000_000;
const MAX_TOTAL = 5_000_000;
const HEX = 16;
const ZERO = 0;
const ONE = 1;
const TWO = 2;
const THREE = 3;
const encoder = new TextEncoder();
const positive = pipe(number(), integer(), minValue(ONE));
const hash = pipe(string(), regex(/^[a-f0-9]{64}$/u));
const count = pipe(number(), integer(), minValue(ZERO));
const kinds = ['words', 'frames', 'packets'];
const kind = picklist(kinds);
const PartSchema = strictObject({
    file: pipe(string(), regex(/^part-[0-9]{3}\.json$/u)),
    kind,
    start: count,
    count: positive,
    bytes: pipe(positive, maxValue(MAX_BYTES)),
    hash,
});
const ManifestSchema = strictObject({
    format: literal('wire-capture-json/1'),
    engine: literal(ENGINE),
    product: string(),
    ticks: positive,
    bytes: pipe(positive, maxValue(MAX_TOTAL)),
    hash,
    parts: pipe(array(PartSchema), minLength(ONE)),
});
function bytes(value) {
    return encoder.encode(`${JSON.stringify(value)}\n`);
}
function partName(index) {
    return `part-${String(index).padStart(THREE, '0')}.json`;
}
async function digest(input) {
    const sum = await crypto.subtle.digest('SHA-256', Uint8Array.from(input).buffer);
    return Array.from(new Uint8Array(sum), (byte) => byte.toString(HEX).padStart(TWO, '0')).join('');
}
class PartBuilder {
    output = [];
    items = [];
    start = ZERO;
    length = THREE;
    kind;
    constructor(kindName) {
        this.kind = kindName;
    }
    flush() {
        if (this.items.length === ZERO) {
            return;
        }
        this.output.push({
            kind: this.kind,
            start: this.start,
            count: this.items.length,
            data: bytes(this.items),
        });
        this.start += this.items.length;
        this.items = [];
        this.length = THREE;
    }
    add(value) {
        const size = bytes(value).byteLength;
        if (size + THREE > MAX_BYTES) {
            throw new Error('One captured value exceeds the repository file cap');
        }
        if (this.length + size > MAX_BYTES) {
            this.flush();
        }
        this.items.push(value);
        this.length += size;
    }
    finish() {
        this.flush();
        return this.output;
    }
}
function split(kindName, values) {
    const builder = new PartBuilder(kindName);
    for (const value of values) {
        builder.add(value);
    }
    return builder.finish();
}
function budget(manifest) {
    const header = bytes(manifest).byteLength;
    if (header > MAX_BYTES ||
        manifest.parts.reduce((sum, part) => sum + part.bytes, header) > MAX_TOTAL) {
        throw new Error('Archived recording exceeds its per-file or whole-session budget');
    }
}
async function seal(draft, index) {
    return {
        file: partName(index),
        kind: draft.kind,
        start: draft.start,
        count: draft.count,
        bytes: draft.data.byteLength,
        hash: await digest(draft.data),
    };
}
function drafts(source) {
    return [
        ...split('words', source.frames.wordTable),
        ...split('frames', source.frames.frames),
        ...split('packets', source.packets),
    ];
}
/** Lossless whole arrays keep every repository file below 1 MB without a bypass. */
async function archiveSession(value) {
    const source = parseStoredSession(value);
    const document = bytes(source);
    const pieces = drafts(source);
    if (document.byteLength > MAX_TOTAL) {
        throw new Error('Recording exceeds the 5 MB whole-session budget');
    }
    const parts = await Promise.all(pieces.map(async (piece, index) => await seal(piece, index)));
    const manifest = {
        format: 'wire-capture-json/1',
        engine: ENGINE,
        product: source.product,
        ticks: source.ticks,
        bytes: document.byteLength,
        hash: await digest(document),
        parts,
    };
    budget(manifest);
    const files = new Map(pieces.map((piece, index) => [
        partName(index),
        piece.data,
    ]));
    return { manifest, files };
}
async function readPart(part, read) {
    const data = await read(part.file);
    if (data.byteLength !== part.bytes || (await digest(data)) !== part.hash) {
        throw new Error('Recording part bytes differ from the manifest');
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    const value = JSON.parse(text);
    const items = parse(array(unknown()), value);
    if (items.length !== part.count) {
        throw new Error('Recording part count differs from the manifest');
    }
    return items;
}
function join(manifest, rows) {
    const sections = {
        words: [],
        frames: [],
        packets: [],
    };
    let rank = ZERO;
    for (const [index, part] of manifest.parts.entries()) {
        const next = kinds.indexOf(part.kind);
        if (part.file !== partName(index) ||
            next < rank ||
            part.start !== sections[part.kind].length) {
            throw new Error('Recording parts must be complete and ordered');
        }
        rank = next;
        for (const value of rows[index] ?? []) {
            sections[part.kind].push(value);
        }
    }
    return {
        version: VERSION,
        engine: ENGINE,
        product: manifest.product,
        ticks: manifest.ticks,
        frames: {
            version: VERSION,
            wordTable: sections.words,
            frames: sections.frames,
        },
        packets: sections.packets,
    };
}
/** Verify complete storage and mandatory frozen replay before returning any recording. */
async function readSessionArchive(value, read) {
    const manifest = parse(ManifestSchema, value);
    budget(manifest);
    const rows = await Promise.all(manifest.parts.map(async (part) => await readPart(part, read)));
    const document = join(manifest, rows);
    const data = bytes(document);
    if (data.byteLength !== manifest.bytes ||
        (await digest(data)) !== manifest.hash) {
        throw new Error('Recording content differs from the manifest');
    }
    return parseSession(document);
}
export { archiveSession, readSessionArchive, };
