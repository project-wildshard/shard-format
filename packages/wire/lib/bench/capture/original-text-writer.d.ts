import { BitWriter } from '../../frozen/v0/bits.ts';
interface TextValue {
    readonly decoded: string;
    readonly original: string;
}
/** Observe text positions once in preparation, never during encode timing. */
declare class OriginalTextWriter extends BitWriter {
    readonly values: TextValue[];
    private offset;
    private readonly source;
    constructor(source: Readonly<Uint8Array>);
    write(value: number, bits: number): void;
    writeText(text: string): void;
}
export { OriginalTextWriter, type TextValue };
