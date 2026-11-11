import type { ByteSink } from './bit-io.ts';
/** One record: its tag and where its body lies in the message. */
interface WireRecordSpan {
    readonly tag: number;
    readonly start: number;
    readonly end: number;
}
/** A uvarint read: its value and the offset after it. */
interface Read {
    readonly value: number;
    readonly next: number;
}
/** What a server does with a client's first message (5.1, 5.5). */
type Bootstrap = {
    readonly kind: 'v1';
    readonly start: number;
} | {
    readonly kind: 'reload' | 'retry' | 'refuse';
};
declare const UINT32_LIMIT = 4294967296;
/** The largest game message, in bytes. */
declare const MAX_MESSAGE_BYTES = 65536;
/** Append a uvarint's bytes. */
declare function writeUvarint(out: ByteSink, value: number): void;
/** Read a uvarint at `at`, never past `end`. */
declare function readUvarint(bytes: Readonly<Uint8Array>, at: number, end: number): Read;
/** Append one record: tag, length, body. */
declare function writeRecord(out: ByteSink, tag: number, body: Readonly<Uint8Array>): void;
/** Every record in `bytes[start, end)`, in order; a bad frame refuses all. */
declare function readRecords(bytes: Readonly<Uint8Array>, start: number, end: number): readonly WireRecordSpan[];
/** Check the two bootstrap bytes before any record parsing. */
declare function readBootstrap(bytes: Readonly<Uint8Array>, major: number): Bootstrap;
/** The bootstrap bytes a v1 client writes first. */
declare function bootstrapBytes(major: number): readonly number[];
export { bootstrapBytes, MAX_MESSAGE_BYTES, readBootstrap, readRecords, readUvarint, UINT32_LIMIT, writeRecord, writeUvarint, type Bootstrap, type WireRecordSpan, };
