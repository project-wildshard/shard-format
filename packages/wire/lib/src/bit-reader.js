/* oxlint-disable no-bitwise -- a bit reader shifts and masks by definition */
import { WireDecodeError } from './wire-error.js';
const BYTE = 8;
const LOW_BITS = 7;
const SHIFT_BYTE = 3;
const WORD = 32;
const ZERO = 0;
const ONE = 1;
const F64_BYTES = 8;
const SECOND_WORD = 4;
const scratch = new DataView(new ArrayBuffer(F64_BYTES));
/** Reads one body, `bytes[start, end)`; it never reads past it. */
class BitReader {
    bit;
    stop;
    bytes;
    constructor(bytes, start, end) {
        this.bytes = bytes;
        this.bit = start * BYTE;
        this.stop = end * BYTE;
    }
    get remaining() {
        return this.stop - this.bit;
    }
    read(bits) {
        if (bits > this.remaining) {
            throw new WireDecodeError('A record body ends early');
        }
        let value = ZERO;
        for (let left = bits; left > ZERO;) {
            const take = Math.min(BYTE - (this.bit & LOW_BITS), left);
            value = value * (ONE << take) + this.chunk(take);
            left -= take;
        }
        return value;
    }
    /** The next `take` bits, all within one byte. */
    chunk(take) {
        const room = BYTE - (this.bit & LOW_BITS);
        const byte = this.bytes[this.bit >>> SHIFT_BYTE] ?? ZERO;
        this.bit += take;
        return (byte >>> (room - take)) & ((ONE << take) - ONE);
    }
    readF32() {
        scratch.setUint32(ZERO, this.read(WORD));
        return scratch.getFloat32(ZERO);
    }
    readF64() {
        const high = this.read(WORD);
        scratch.setUint32(SECOND_WORD, this.read(WORD));
        scratch.setUint32(ZERO, high);
        return scratch.getFloat64(ZERO);
    }
    end() {
        const left = this.remaining;
        if (left >= BYTE || (left > ZERO && this.read(left) !== ZERO)) {
            throw new WireDecodeError('A record body has trailing bits');
        }
    }
}
export { BitReader };
