import { BitReader, BitWriter } from '../../frozen/v0/bits.js';
const ZERO = 0;
const BYTE_BITS = 8;
const MAX_READ_BITS = 32;
const decoder = new TextDecoder('utf-8', { fatal: true });
const originalDecoder = new TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: true,
});
function textBytesAt(source, offset) {
    const reader = new BitReader(source);
    let remaining = offset;
    while (remaining > ZERO) {
        const count = Math.min(remaining, MAX_READ_BITS);
        reader.read(count);
        remaining -= count;
    }
    const bytes = Uint8Array.from({ length: reader.read(BYTE_BITS) }, () => reader.read(BYTE_BITS));
    return bytes;
}
/** Observe text positions once in preparation, never during encode timing. */
class OriginalTextWriter extends BitWriter {
    values = [];
    offset = ZERO;
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
        const bytes = textBytesAt(this.source, this.offset);
        if (decoder.decode(bytes) !== text) {
            throw new Error('Captured text differs from its frozen decoded value');
        }
        const original = originalDecoder.decode(bytes);
        this.values.push({ decoded: text, original });
        super.writeText(original);
    }
}
export { OriginalTextWriter };
