import { decodeCold, encodeCold } from './cold.js';
import { bootstrapBytes, readBootstrap, readRecords, readUvarint, recordBytes, writeUvarint, } from './framing.js';
import { WIRE_MAJOR } from './major.js';
import { HELLO, WELCOME } from './records.js';
import { WireDecodeError } from './wire-error.js';
const HELLO_TAG = 1;
const WELCOME_TAG = 4;
const ZERO = 0;
const ONE = 1;
const THREE = 3;
const utf8Out = new TextEncoder();
const utf8In = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
/** Net text's cap (`MAX_NET_TEXT_BYTES`), cold or hot. */
const MAX_TEXT_BYTES = 255;
const FNV_OFFSET = 2_166_136_261;
const FNV_PRIME = 16_777_619;
/** FNV-1a over each table block's length and bytes: `tableHash` (5.3). */
function tableHash(blocks) {
    let hash = FNV_OFFSET;
    for (const block of blocks) {
        const head = [];
        writeUvarint(head, block.length);
        for (const byte of [...head, ...block]) {
            // oxlint-disable-next-line no-bitwise -- FNV-1a is xor and 32-bit multiply
            hash = Math.imul(hash ^ byte, FNV_PRIME) >>> ZERO;
        }
    }
    return hash;
}
function idsBytes(ids) {
    const out = [];
    for (const id of ids) {
        writeUvarint(out, id);
    }
    return Uint8Array.from(out);
}
function readIds(value) {
    if (!(value instanceof Uint8Array)) {
        return [];
    }
    const ids = [];
    for (let at = ZERO; at < value.length;) {
        const read = readUvarint(value, at, value.length);
        ids.push(read.value);
        at = read.next;
    }
    return ids;
}
function textOf(value) {
    if (!(value instanceof Uint8Array)) {
        return '';
    }
    if (value.length > MAX_TEXT_BYTES) {
        throw new WireDecodeError('A cold text exceeds 255 bytes');
    }
    try {
        return utf8In.decode(value);
    }
    catch {
        throw new WireDecodeError('A cold text is not UTF-8');
    }
}
const numberOf = (value) => typeof value === 'number' ? value : ZERO;
const bytesOf = (value) => value instanceof Uint8Array ? value : new Uint8Array(ZERO);
/** A v1 client's first message: bootstrap, then the hello record. */
function encodeHello(hello) {
    const body = encodeCold(HELLO, {
        minor: hello.minor,
        build: utf8Out.encode(hello.build),
        player: utf8Out.encode(hello.player),
        name: utf8Out.encode(hello.name),
        ledger: hello.ledger,
        capabilities: idsBytes(hello.capabilities),
        commandTable: hello.commandTable,
        actTable: hello.actTable,
    });
    const boot = bootstrapBytes(WIRE_MAJOR);
    const record = recordBytes(HELLO_TAG, body);
    const out = new Uint8Array(boot.length + record.length);
    out.set(boot);
    out.set(record, boot.length);
    return out;
}
function helloOf(values) {
    return {
        minor: numberOf(values['minor']),
        build: textOf(values['build']),
        player: textOf(values['player']),
        name: textOf(values['name']),
        ledger: numberOf(values['ledger']),
        capabilities: readIds(values['capabilities']),
        commandTable: bytesOf(values['commandTable']),
        actTable: bytesOf(values['actTable']),
    };
}
/** The one hello record after the bootstrap, or undefined. */
function helloSpan(bytes, start) {
    // Exactly one hello; any other record is a later minor's, skipped (5.1).
    const hellos = readRecords(bytes, start, bytes.length).filter((record) => record.tag === HELLO_TAG);
    const [record] = hellos;
    return hellos.length === ONE && record !== undefined
        ? { bytes, start: record.start, end: record.end }
        : undefined;
}
/** Read a client's first message: the bootstrap bytes before any record. */
function decodeFirstMessage(bytes) {
    const bootstrap = readBootstrap(bytes, WIRE_MAJOR);
    if (bootstrap.kind !== 'v1') {
        return bootstrap;
    }
    try {
        const span = helloSpan(bytes, bootstrap.start);
        return span === undefined
            ? { kind: 'refuse' }
            : { kind: 'hello', hello: helloOf(decodeCold(HELLO, span)) };
    }
    catch (error) {
        if (error instanceof WireDecodeError) {
            return { kind: 'refuse' };
        }
        throw error;
    }
}
/** The welcome record, with its tables unless `tables` is absent. */
function encodeWelcome(welcome) {
    const values = {
        minor: welcome.minor,
        build: utf8Out.encode(welcome.build),
        handle: welcome.handle,
        player: utf8Out.encode(welcome.player),
        tick: welcome.tick,
        cell: welcome.cell,
        simHz: welcome.simHz,
        frameHz: welcome.frameHz,
        capabilities: idsBytes(welcome.capabilities),
        requiredCapabilities: idsBytes(welcome.requiredCapabilities),
        tableHash: welcome.tableHash,
        ...welcome.tables,
    };
    return recordBytes(WELCOME_TAG, encodeCold(WELCOME, values));
}
/** All three table blocks, or none: a travel welcome holds none. */
function tablesOf(values) {
    const { classTables, eventTables, rideLawTables } = values;
    const held = [classTables, eventTables, rideLawTables].filter((block) => block instanceof Uint8Array).length;
    if (held === ZERO) {
        return undefined;
    }
    if (held !== THREE) {
        throw new WireDecodeError('A welcome holds some of its table blocks');
    }
    return {
        classTables: bytesOf(classTables),
        eventTables: bytesOf(eventTables),
        rideLawTables: bytesOf(rideLawTables),
    };
}
/** Read a welcome record's body. */
function decodeWelcome(span) {
    const values = decodeCold(WELCOME, span);
    const tables = tablesOf(values);
    return {
        minor: numberOf(values['minor']),
        build: textOf(values['build']),
        handle: numberOf(values['handle']),
        player: textOf(values['player']),
        tick: numberOf(values['tick']),
        cell: numberOf(values['cell']),
        simHz: numberOf(values['simHz']),
        frameHz: numberOf(values['frameHz']),
        capabilities: readIds(values['capabilities']),
        requiredCapabilities: readIds(values['requiredCapabilities']),
        tableHash: numberOf(values['tableHash']),
        ...(tables === undefined ? {} : { tables }),
    };
}
export { decodeFirstMessage, decodeWelcome, encodeHello, encodeWelcome, tableHash, };
