import { readUvarint } from './framing.js';
import { WireDecodeError } from './wire-error.js';
// A bounded cursor over one table block (5.3). Counts, depth and node totals
// are capped, so a hostile table stays small however it nests.
const ZERO = 0;
const ONE = 1;
const F64_BYTES = 8;
const MAX_DEPTH = 8;
const MAX_COUNT = 255;
const MAX_NODES = 4096;
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const scratch = new DataView(new ArrayBuffer(F64_BYTES));
/** Reads one table block, `bytes[start, end)`. */
class TableReader {
    at;
    nodes = ZERO;
    bytes;
    end;
    constructor(bytes, start, end) {
        this.bytes = bytes;
        this.at = start;
        this.end = end;
    }
    /** Whether every byte was read. */
    get done() {
        return this.at === this.end;
    }
    uvarint() {
        const { value, next } = readUvarint(this.bytes, this.at, this.end);
        this.at = next;
        return value;
    }
    /** A count of fields, arms or words: at most 255. */
    count() {
        const value = this.uvarint();
        if (value > MAX_COUNT) {
            throw new WireDecodeError('A table count is past its bound');
        }
        return value;
    }
    f64() {
        if (this.at + F64_BYTES > this.end) {
            throw new WireDecodeError('A table ends early');
        }
        for (let index = ZERO; index < F64_BYTES; index += ONE) {
            scratch.setUint8(index, this.bytes[this.at + index] ?? ZERO);
        }
        this.at += F64_BYTES;
        return scratch.getFloat64(ZERO);
    }
    word() {
        const length = this.count();
        if (this.at + length > this.end) {
            throw new WireDecodeError('A table word ends early');
        }
        const bytes = this.bytes.slice(this.at, this.at + length);
        this.at += length;
        try {
            return utf8.decode(bytes);
        }
        catch {
            throw new WireDecodeError('A table word is not UTF-8');
        }
    }
    /** Count one node at `depth`, refusing a table too deep or too large. */
    tick(depth) {
        this.nodes += ONE;
        if (depth > MAX_DEPTH || this.nodes > MAX_NODES) {
            throw new WireDecodeError('A table is too deep or too large');
        }
    }
}
export { TableReader };
