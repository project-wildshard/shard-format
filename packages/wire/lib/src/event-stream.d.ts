import type { BitSink, BitSource, Span } from './bit-io.ts';
import type { WireStruct } from './codec.ts';
import type { WireEvent } from './game.ts';
/** A spawn's class columns, after its own fields (WR4 fills these). */
interface SpawnColumns {
    readonly write: (writer: BitSink, fields: WireStruct) => void;
    readonly read: (reader: BitSource, fields: WireStruct) => WireStruct;
}
/** One `events` record, read. */
interface ReadEvents {
    readonly tick: number;
    readonly events: readonly WireEvent[];
    readonly skipped: readonly number[];
}
/** The server's event tables (welcome): every event record's fields. */
declare function eventTables(): Uint8Array;
/** One `events` message: the tick, then each event as its own record. */
declare function encodeEvents(tick: number, events: readonly WireEvent[], columns?: SpawnColumns): Uint8Array<ArrayBuffer>;
/** Decoders for a server's event tables, projected onto local events. */
declare function eventsDecoder(tables: Readonly<Uint8Array>, columns?: SpawnColumns): (span: Span) => ReadEvents;
export { encodeEvents, eventsDecoder, eventTables, type ReadEvents, type SpawnColumns, };
