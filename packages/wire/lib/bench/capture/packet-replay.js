import { BitReader, BitWriter } from '../../frozen/v0/bits.js';
import { decodeCommands, encodeCommands } from '../../frozen/v0/command.js';
import { decodeAct, decodeEvents, decodeHello, decodeWelcome, encodeAct, encodeEvents, encodeHello, encodeWelcome, } from '../../frozen/v0/messages.js';
import { V0_CLASSES } from '../../frozen/v0/tables.js';
import { bytesText, textBytes } from './frame-data.js';
const BYTE_BITS = 8;
const MAX_READ_BITS = 32;
const decoder = new TextDecoder('utf-8', { fatal: true });
const originalDecoder = new TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: true,
});
/** Observe text positions once in preparation, never during encode timing. */
class OriginalTextWriter extends BitWriter {
    values = [];
    offset = 0;
    source;
    constructor(source) {
        super();
        this.source = source;
    }
    write(value, bits) {
        super.write(value, bits);
        this.offset += bits;
    }
    writeText(text) {
        const reader = new BitReader(this.source);
        let remaining = this.offset;
        while (remaining > 0) {
            const count = Math.min(remaining, MAX_READ_BITS);
            reader.read(count);
            remaining -= count;
        }
        const bytes = Uint8Array.from({ length: reader.read(BYTE_BITS) }, () => reader.read(BYTE_BITS));
        if (decoder.decode(bytes) !== text) {
            throw new Error('Captured text differs from its frozen decoded value');
        }
        const original = originalDecoder.decode(bytes);
        this.values.push({ decoded: text, original });
        super.writeText(original);
    }
}
/** Used only for records containing a BOM; ordinary captures use BitWriter. */
class PreparedTextWriter extends BitWriter {
    index = 0;
    values;
    constructor(values) {
        super();
        this.values = values;
    }
    writeText(text) {
        const value = this.values[this.index];
        this.index += 1;
        if (value === undefined || value.decoded !== text) {
            throw new Error('Captured text sequence differs');
        }
        super.writeText(value.original);
    }
    finish() {
        if (this.index !== this.values.length) {
            throw new Error('Captured text sequence is incomplete');
        }
        return super.finish();
    }
}
const NO_HANDLE = 0;
const HANDLE_TOP = 0xffff;
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
function decodePacket(record) {
    const bytes = textBytes(record.bytes);
    switch (bytes[0]) {
        case 1: {
            const value = required(decodeHello(bytes));
            return {
                stream: 'hello',
                encode: (writer) => encodeHello(writer, value),
                decode: () => required(decodeHello(bytes)),
            };
        }
        case 2: {
            const value = required(decodeCommands(bytes, ids));
            return {
                stream: 'commands',
                encode: (writer) => encodeCommands(writer, value, refs),
                decode: () => required(decodeCommands(bytes, ids)),
            };
        }
        case 3: {
            const value = required(decodeAct(bytes));
            return {
                stream: 'act',
                encode: (writer) => encodeAct(writer, value),
                decode: () => required(decodeAct(bytes)),
            };
        }
        case 4: {
            const value = required(decodeWelcome(bytes));
            return {
                stream: 'welcome',
                encode: (writer) => encodeWelcome(writer, value),
                decode: () => required(decodeWelcome(bytes)),
            };
        }
        case 6: {
            const value = required(decodeEvents(bytes, initial));
            return {
                stream: 'events',
                encode: (writer) => encodeEvents(writer, value.tick, value.events, initial),
                decode: () => required(decodeEvents(bytes, initial)),
            };
        }
        default:
            throw new Error('Non-frame packet capture requires a frozen v0 stream');
    }
}
/** The byte oracle is mandatory when reading a persisted recording too. */
function preparePacket(record) {
    const decoded = decodePacket(record);
    const writer = new OriginalTextWriter(textBytes(record.bytes));
    const replay = decoded.encode(writer);
    if (bytesText(new Uint8Array(replay)) !== record.bytes) {
        throw new Error('Frozen v0 packet replay differs from real bytes');
    }
    const values = writer.values;
    const restoresText = values.some((value) => value.original !== value.decoded);
    return {
        stream: decoded.stream,
        encode: () => decoded.encode(restoresText ? new PreparedTextWriter(values) : new BitWriter()),
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
