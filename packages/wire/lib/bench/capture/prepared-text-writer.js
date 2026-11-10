import { BitWriter } from '../../frozen/v0/bits.js';
const ZERO = 0;
const ONE = 1;
/** Used only for records containing a BOM; ordinary captures use BitWriter. */
class PreparedTextWriter extends BitWriter {
    index = ZERO;
    values;
    constructor(values) {
        super();
        this.values = values;
    }
    writeText(text) {
        const value = this.values[this.index];
        this.index += ONE;
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
export { PreparedTextWriter };
