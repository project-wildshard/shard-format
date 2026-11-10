import { BitWriter } from '../../frozen/v0/bits.js';
import { decodeCommands, encodeCommands } from '../../frozen/v0/command.js';
import { decodeAct, decodeEvents, decodeHello, decodeWelcome, encodeAct, encodeEvents, encodeHello, encodeWelcome, } from '../../frozen/v0/messages.js';
import { V0_CLASSES } from '../../frozen/v0/tables.js';
import { bytesText, textBytes } from './frame-data.js';
import { OriginalTextWriter } from './original-text-writer.js';
import { PreparedTextWriter } from './prepared-text-writer.js';
const ZERO = 0;
const NO_HANDLE = 0;
const HANDLE_TOP = 65_535;
const PREFIX = 'captured-handle:';
function initial(cls) {
    const table = V0_CLASSES.find((row) => row.id === cls);
    return table === undefined
        ? undefined
        : {
            bits: table.initial.map((column) => column.bits),
            text: table.text.length,
        };
}
function ids(handle) {
    return handle > NO_HANDLE && handle <= HANDLE_TOP
        ? `${PREFIX}${String(handle)}`
        : undefined;
}
function refs(id) {
    const handle = Number(id.slice(PREFIX.length));
    if (!id.startsWith(PREFIX) || ids(handle) !== id) {
        throw new Error('Invalid captured command handle');
    }
    return handle;
}
function required(value) {
    if (value === null) {
        throw new Error('Frozen v0 refuses captured packet');
    }
    return value;
}
/** Decode once outside encode timing, retaining exact decoded input values.
 * Frames need their actual per-handle baselines and use FrameTrace instead.
 */
function hello(bytes) {
    const value = required(decodeHello(bytes));
    return {
        stream: 'hello',
        encode: (writer) => encodeHello(writer(), value),
        decode: () => required(decodeHello(bytes)),
    };
}
function commands(bytes) {
    const value = required(decodeCommands(bytes, ids));
    return {
        stream: 'commands',
        encode: (writer) => encodeCommands(writer(), value, refs),
        decode: () => required(decodeCommands(bytes, ids)),
    };
}
function act(bytes) {
    const value = required(decodeAct(bytes));
    return {
        stream: 'act',
        encode: (writer) => encodeAct(writer(), value),
        decode: () => required(decodeAct(bytes)),
    };
}
function welcome(bytes) {
    const value = required(decodeWelcome(bytes));
    return {
        stream: 'welcome',
        encode: (writer) => encodeWelcome(writer(), value),
        decode: () => required(decodeWelcome(bytes)),
    };
}
function events(bytes) {
    const value = required(decodeEvents(bytes, initial));
    return {
        stream: 'events',
        encode: (writer) => encodeEvents(writer(), value.tick, value.events, initial),
        decode: () => required(decodeEvents(bytes, initial)),
    };
}
const CODECS = {
    1: hello,
    2: commands,
    3: act,
    4: welcome,
    6: events,
};
function decodePacket(record) {
    const bytes = textBytes(record.bytes);
    const id = bytes.at(ZERO);
    const codec = id === undefined ? undefined : CODECS[id];
    if (codec === undefined) {
        throw new Error('Non-frame packet capture requires a frozen v0 stream');
    }
    return codec(bytes);
}
/** The byte oracle is mandatory when reading a persisted recording too. */
function preparePacket(record) {
    const decoded = decodePacket(record);
    const writer = new OriginalTextWriter(textBytes(record.bytes));
    const replay = decoded.encode(() => writer);
    if (bytesText(new Uint8Array(replay)) !== record.bytes) {
        throw new Error('Frozen v0 packet replay differs from real bytes');
    }
    const { values } = writer;
    const restoresText = values.some((value) => value.original !== value.decoded);
    return {
        stream: decoded.stream,
        encode: () => decoded.encode(() => restoresText ? new PreparedTextWriter(values) : new BitWriter()),
        decode: decoded.decode,
    };
}
/** Refuse any non-identical replay before a transport packet reaches the sink. */
function capturePacket(bytes) {
    const record = { bytes: bytesText(bytes) };
    preparePacket(record);
    return record;
}
export { capturePacket, preparePacket, };
