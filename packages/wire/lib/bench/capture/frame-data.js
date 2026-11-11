import { array, boolean, exactOptional, number, object, parse, string, } from 'valibot';
const RowSchema = object({
    handle: number(),
    classId: number(),
    words: string(),
});
const RowsSchema = array(RowSchema);
const SnapshotSchema = object({ tick: number(), rows: RowsSchema });
const VisibleSchema = array(number());
const BaselineSchema = object({
    frame: SnapshotSchema,
    visible: VisibleSchema,
    hasRowFrom: boolean(),
});
const ClassSchema = object({ handle: number(), id: number() });
const RowCallSchema = object({
    handle: number(),
    source: exactOptional(SnapshotSchema),
});
const DueSchema = object({ handle: number(), value: boolean() });
const CaptureSchema = object({
    frame: SnapshotSchema,
    cell: number(),
    lastSeq: number(),
    ownerClass: number(),
    owner: string(),
    ride: exactOptional(string()),
    rideWords: exactOptional(number()),
    visible: VisibleSchema,
    baseline: exactOptional(BaselineSchema),
    classes: array(ClassSchema),
    hasDue: boolean(),
    rowFromCalls: array(RowCallSchema),
    dueCalls: array(DueSchema),
    bytes: string(),
});
const WORD_BYTES = 4;
const DOUBLE_BYTES = 8;
const DOUBLE_WORDS = 2;
const ZERO = 0;
const ONE = 1;
function bytesText(bytes) {
    const text = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
    return btoa(text);
}
function textBytes(text) {
    const decoded = atob(text);
    const bytes = new Uint8Array(decoded.length);
    for (let index = ZERO; index < decoded.length; index += ONE) {
        bytes[index] = decoded.codePointAt(index) ?? ZERO;
    }
    return bytes;
}
function packWords(words) {
    const bytes = new Uint8Array(words.length * WORD_BYTES);
    const view = new DataView(bytes.buffer);
    for (let index = ZERO; index < words.length; index += ONE) {
        view.setUint32(index * WORD_BYTES, words[index] ?? ZERO);
    }
    return bytesText(bytes);
}
function unpackWords(text) {
    const bytes = textBytes(text);
    if (bytes.length % WORD_BYTES !== ZERO) {
        throw new Error('Unaligned captured row');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return Uint32Array.from({ length: bytes.length / WORD_BYTES }, (_unused, index) => view.getUint32(index * WORD_BYTES));
}
function packDoubles(values) {
    const view = new DataView(new ArrayBuffer(values.length * DOUBLE_BYTES));
    const words = new Uint32Array(values.length * DOUBLE_WORDS);
    for (let index = ZERO; index < values.length; index += ONE) {
        view.setFloat64(index * DOUBLE_BYTES, values[index] ?? ZERO);
        words[index * DOUBLE_WORDS] = view.getUint32(index * DOUBLE_BYTES);
        words[index * DOUBLE_WORDS + ONE] = view.getUint32(index * DOUBLE_BYTES + WORD_BYTES);
    }
    return packWords(words);
}
function unpackDoubles(text) {
    const words = unpackWords(text);
    if (words.length % DOUBLE_WORDS !== ZERO) {
        throw new Error('Unaligned captured owner');
    }
    const view = new DataView(new ArrayBuffer(words.length * WORD_BYTES));
    for (let index = ZERO; index < words.length; index += ONE) {
        view.setUint32(index * WORD_BYTES, words[index] ?? ZERO);
    }
    return Float64Array.from({ length: words.length / DOUBLE_WORDS }, (_unused, index) => view.getFloat64(index * DOUBLE_BYTES));
}
function parseFrameCapture(value) {
    return parse(CaptureSchema, value);
}
export { bytesText, textBytes, packWords, unpackWords, packDoubles, unpackDoubles, parseFrameCapture, };
