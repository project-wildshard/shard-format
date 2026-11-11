import { WireDecodeError } from './wire-error.js';
const ZERO = 0;
const ONE = 1;
/** A uvarint byte's continuation threshold: 2^7. */
const CONTINUE = 128;
const MAX_VARINT_BYTES = 5;
const UINT32_LIMIT = 4_294_967_296;
/** The largest game message, in bytes. */
const MAX_MESSAGE_BYTES = 65_536;
/** The first byte of a v1 client's first message: ASCII `W`. */
const BOOTSTRAP = 87;
/** The v0.1.x hello's first byte (`MSG_HELLO`). */
const V0_HELLO = 1;
const BOOTSTRAP_BYTES = 2;
/** Append a uvarint's bytes. */
function writeUvarint(out, value) {
    if (!Number.isInteger(value) || value < ZERO || value >= UINT32_LIMIT) {
        throw new RangeError(`A uvarint holds 0 to 2^32 - 1, not ${String(value)}`);
    }
    let rest = value;
    while (rest >= CONTINUE) {
        out.push((rest % CONTINUE) + CONTINUE);
        rest = Math.floor(rest / CONTINUE);
    }
    out.push(rest);
}
/** The checks on a uvarint's last byte: minimal and in range. */
function finish(value, byte, index) {
    if (byte === ZERO && index > ZERO) {
        throw new WireDecodeError('A uvarint is not minimal');
    }
    if (value >= UINT32_LIMIT) {
        throw new WireDecodeError('A uvarint exceeds 2^32 - 1');
    }
}
/** The byte at `at`, refusing a uvarint that runs past `end`. */
function byteAt(bytes, at, end) {
    const byte = at < end ? bytes[at] : undefined;
    if (byte === undefined) {
        throw new WireDecodeError('A uvarint is truncated');
    }
    return byte;
}
/** Read a uvarint at `at`, never past `end`. */
function readUvarint(bytes, at, end) {
    let value = ZERO;
    for (let index = ZERO; index < MAX_VARINT_BYTES; index += ONE) {
        const byte = byteAt(bytes, at + index, end);
        value += (byte % CONTINUE) * CONTINUE ** index;
        if (byte < CONTINUE) {
            finish(value, byte, index);
            return { value, next: at + index + ONE };
        }
    }
    throw new WireDecodeError('A uvarint is longer than 5 bytes');
}
/** Append one record: tag, length, body. */
function writeRecord(out, tag, body) {
    writeUvarint(out, tag);
    writeUvarint(out, body.length);
    out.push(...body);
}
/** One record at `at`: its span, refusing a length past `end`. */
function readRecord(bytes, at, end) {
    const tag = readUvarint(bytes, at, end);
    if (tag.value === ZERO) {
        throw new WireDecodeError('A record tag is 0');
    }
    const length = readUvarint(bytes, tag.next, end);
    const stop = length.next + length.value;
    if (stop > end) {
        throw new WireDecodeError('A record length runs past the message');
    }
    return { tag: tag.value, start: length.next, end: stop };
}
/** Every record in `bytes[start, end)`, in order; a bad frame refuses all. */
function readRecords(bytes, start, end) {
    if (end - start > MAX_MESSAGE_BYTES) {
        throw new WireDecodeError('A message exceeds 64 KiB');
    }
    const records = [];
    for (let at = start; at < end;) {
        const record = readRecord(bytes, at, end);
        records.push(record);
        at = record.end;
    }
    return records;
}
/** Check the two bootstrap bytes before any record parsing. */
function readBootstrap(bytes, major) {
    const [first, second] = bytes;
    if (first === V0_HELLO) {
        return { kind: 'reload' };
    }
    if (first !== BOOTSTRAP || second === undefined) {
        return { kind: 'refuse' };
    }
    if (second === major) {
        return { kind: 'v1', start: BOOTSTRAP_BYTES };
    }
    return { kind: second < major ? 'reload' : 'retry' };
}
/** The bootstrap bytes a v1 client writes first. */
function bootstrapBytes(major) {
    return [BOOTSTRAP, major];
}
export { bootstrapBytes, MAX_MESSAGE_BYTES, readBootstrap, readRecords, readUvarint, UINT32_LIMIT, writeRecord, writeUvarint, };
