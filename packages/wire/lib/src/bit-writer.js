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
    write(value, bits) {
        const end = this.bit + bits;
        if (end > this.bytes.length * BYTE) {
            this.grow(end);
        }
        const word = value >>> ZERO;
        for (let left = bits; left > ZERO;) {
            left -= this.put(word, left);
        }
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
    /** Write the next chunk of `word`'s low `left` bits; the bits taken. */
    put(word, left) {
        const room = BYTE - (this.bit & LOW_BITS);
        const take = Math.min(room, left);
        const at = this.bit >>> SHIFT_BYTE;
        const chunk = (word >>> (left - take)) & ((ONE << take) - ONE);
        this.bytes[at] = (this.bytes[at] ?? ZERO) | (chunk << (room - take));
        this.bit += take;
        return take;
    }
    grow(bits) {
        const size = Math.max(this.bytes.length * GROWTH, Math.ceil(bits / BYTE));
        const next = new Uint8Array(size);
        next.set(this.bytes);
        this.bytes = next;
    }
}
export { BitWriter };
