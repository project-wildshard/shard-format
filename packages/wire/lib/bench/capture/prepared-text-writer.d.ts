import { BitWriter } from '../../frozen/v0/bits.ts';
import type { TextValue } from './original-text-writer.ts';
/** Used only for records containing a BOM; ordinary captures use BitWriter. */
declare class PreparedTextWriter extends BitWriter {
    private index;
    private readonly values;
    constructor(values: readonly TextValue[]);
    writeText(text: string): void;
    finish(): ArrayBuffer;
}
export { PreparedTextWriter };
