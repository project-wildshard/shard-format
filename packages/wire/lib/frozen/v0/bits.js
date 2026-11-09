// P1-E5.2 (E5-REPLICATION §3.3): the bit packer every wire message is written with. Big-endian within a byte, no
// alignment between fields, so a declared 10-bit angle costs exactly 10 bits.
/** Bytes that are not a well-formed message. A decoder catches this at its boundary; it never reaches game code. */
export class NetDecodeError extends Error {
    constructor(message, options) { super(message, options); this.name = 'NetDecodeError'; }
}
const floats = new Float32Array(1), floatBits = new Uint32Array(floats.buffer);
/** A float32's IEEE bits, the unquantised form the owner block carries (§3.5). */
export function floatToBits(value) { floats[0] = value; return floatBits[0] ?? 0; }
/** The float32 those bits name. */
export function bitsToFloat(bits) { floatBits[0] = bits; return floats[0] ?? 0; }
const double = new DataView(new ArrayBuffer(8));
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
/** Strings on the wire are stable ids and spawn fields: never longer than an id's 128 chars in UTF-8. */
export const MAX_NET_TEXT_BYTES = 255;
/** Writes one message, then detaches it with `finish`. A writer is reused: nothing allocates per field. */
export class BitWriter {
    bytes;
    bit = 0;
    constructor(capacity = 1024) { this.bytes = new Uint8Array(capacity); }
    /** Bits written so far in this message. */
    get bitLength() { return this.bit; }
    /** Write the low `bits` (1–32) of an unsigned integer. */
    write(value, bits) {
        const end = this.bit + bits;
        if (end > this.bytes.length * 8)
            this.grow(end);
        let left = bits;
        const word = value >>> 0;
        while (left > 0) {
            const used = this.bit & 7, room = 8 - used, take = Math.min(room, left);
            const chunk = (word >>> (left - take)) & ((1 << take) - 1), at = this.bit >>> 3;
            this.bytes[at] = (this.bytes[at] ?? 0) | (chunk << (room - take));
            this.bit += take;
            left -= take;
        }
    }
    /** Write a double's IEEE bits (J140): a client and a server that must hold the same position hold the same bits. */
    writeDouble(value) { double.setFloat64(0, value); this.write(double.getUint32(0), 32); this.write(double.getUint32(4), 32); }
    /** Write one flag bit. */
    writeBool(value) { this.write(value ? 1 : 0, 1); }
    /** Write a length-prefixed UTF-8 string of at most MAX_NET_TEXT_BYTES bytes. */
    writeText(text) {
        const bytes = encoder.encode(text);
        if (bytes.length > MAX_NET_TEXT_BYTES)
            throw new RangeError('Net text exceeds its byte cap');
        this.write(bytes.length, 8);
        for (const byte of bytes)
            this.write(byte, 8);
    }
    /** Detach the finished message as its own transferable buffer and start the next one. */
    finish() {
        const length = Math.ceil(this.bit / 8), out = this.bytes.slice(0, length).buffer;
        this.bytes.fill(0, 0, length);
        this.bit = 0;
        return out;
    }
    grow(bits) {
        const next = new Uint8Array(Math.max(this.bytes.length * 2, Math.ceil(bits / 8)));
        next.set(this.bytes);
        this.bytes = next;
    }
}
/** Cut text to fit `maxBytes` of UTF-8, at a whole character. */
export function fitText(text, maxBytes) {
    if (encoder.encode(text).length <= maxBytes)
        return text;
    let out = '', used = 0;
    for (const char of text) {
        used += encoder.encode(char).length;
        if (used > maxBytes)
            break;
        out += char;
    }
    return out;
}
/** Reads one message. Every read past the end throws NetDecodeError, so untrusted lengths stay bounded. */
export class BitReader {
    bytes;
    bit = 0;
    constructor(bytes) { this.bytes = bytes; }
    /** Bits not yet read. */
    get remaining() { return this.bytes.length * 8 - this.bit; }
    /** Read `bits` (1–32) as an unsigned integer. */
    read(bits) {
        if (bits > this.remaining)
            throw new NetDecodeError('Message ends early');
        let left = bits, value = 0;
        while (left > 0) {
            const used = this.bit & 7, room = 8 - used, take = Math.min(room, left);
            const chunk = ((this.bytes[this.bit >>> 3] ?? 0) >>> (room - take)) & ((1 << take) - 1);
            value = value * (1 << take) + chunk;
            this.bit += take;
            left -= take;
        }
        return value;
    }
    /** Read a double, bit for bit. */
    readDouble() { double.setUint32(0, this.read(32)); double.setUint32(4, this.read(32)); return double.getFloat64(0); }
    /** Read one flag bit. */
    readBool() { return this.read(1) === 1; }
    /** Read a length-prefixed UTF-8 string. */
    readText() {
        const length = this.read(8);
        if (length * 8 > this.remaining)
            throw new NetDecodeError('Text overruns the message');
        const bytes = new Uint8Array(length);
        for (let index = 0; index < length; index++)
            bytes[index] = this.read(8);
        try {
            return decoder.decode(bytes);
        }
        catch (error) {
            throw new NetDecodeError('Text is not UTF-8', { cause: error });
        }
    }
    /** Refuse trailing bytes: a well-formed message ends in the byte its last bit falls in. */
    end() { if (this.remaining >= 8)
        throw new NetDecodeError('Trailing bytes after the message'); }
}
