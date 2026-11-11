/* oxlint-disable no-bitwise -- a bit packer shifts and masks by definition */
import { putUvarint, uvarintLength } from './framing.js';
const BYTE = 8;
const LOW_BITS = 7;
const SHIFT_BYTE = 3;
const WORD = 32;
const ZERO = 0;
const ONE = 1;
const INITIAL_BYTES = 256;
const GROWTH = 2;
const F64_BYTES = 8;
const SECOND_WORD = 4;
const scratch = new DataView(new ArrayBuffer(F64_BYTES));
/** Writes one body; `take` detaches it, padded to a byte, and resets. */
class BitWriter {
    bytes = new Uint8Array(INITIAL_BYTES);
    bit = ZERO;
    // oxlint-disable-next-line max-statements -- the hot path, inlined for WB2's encode budget
    write(value, bits) {
        const end = this.bit + bits;
        if (end > this.bytes.length * BYTE) {
            this.grow(end);
        }
        const word = value >>> ZERO;
        const { bytes } = this;
        let { bit } = this;
        let left = bits;
        while (left > ZERO) {
            const room = BYTE - (bit & LOW_BITS);
            const take = room < left ? room : left;
            const at = bit >>> SHIFT_BYTE;
            bytes[at] =
                (bytes[at] ?? ZERO) |
                    (((word >>> (left - take)) & ((ONE << take) - ONE)) << (room - take));
            bit += take;
            left -= take;
        }
        this.bit = bit;
    }
    writeF32(value) {
        scratch.setFloat32(ZERO, value);
        this.write(scratch.getUint32(ZERO), WORD);
    }
    writeF64(value) {
        scratch.setFloat64(ZERO, value);
        this.write(scratch.getUint32(ZERO), WORD);
        this.write(scratch.getUint32(SECOND_WORD), WORD);
    }
    take() {
        const length = Math.ceil(this.bit / BYTE);
        const out = this.bytes.slice(ZERO, length);
        this.bytes.fill(ZERO, ZERO, length);
        this.bit = ZERO;
        return out;
    }
    takeRecord(tag) {
        const length = Math.ceil(this.bit / BYTE);
        const head = uvarintLength(tag) + uvarintLength(length);
        const out = new Uint8Array(head + length);
        putUvarint(out, putUvarint(out, ZERO, tag), length);
        out.set(this.bytes.subarray(ZERO, length), head);
        this.bytes.fill(ZERO, ZERO, length);
        this.bit = ZERO;
        return out;
    }
    grow(bits) {
        const size = Math.max(this.bytes.length * GROWTH, Math.ceil(bits / BYTE));
        const next = new Uint8Array(size);
        next.set(this.bytes);
        this.bytes = next;
    }
}
export { BitWriter };
