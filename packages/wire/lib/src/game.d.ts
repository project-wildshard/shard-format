import type { Span } from './bit-io.ts';
import type { Decode, Encode, WireStruct } from './codec.ts';
import type { WireRecordSpan } from './framing.ts';
import type { WireField, WireNode } from './grammar.ts';
/** A record's body codec: encode locally, decode a peer's layout. */
interface BodyCodec {
    readonly encode: Encode;
    readonly decode: Decode;
}
/** One event: its local name and fields. */
interface WireEvent {
    readonly event: string;
    readonly fields: WireStruct;
}
/** What a message held: its known records, and the tags it skipped. */
interface ReadMessage {
    readonly records: readonly WireRecordSpan[];
    readonly skipped: readonly number[];
}
/** The `cmds`, `act` and `events` message tags. */
declare const TAG_CMDS = 2;
declare const TAG_ACT = 3;
declare const TAG_EVENTS = 6;
declare const TICK_BITS = 32;
declare const TICK_BYTES = 4;
declare const struct: (fields: readonly WireField[]) => WireNode;
/** One top-level table entry. */
declare const entry: (id: number, name: string, node: WireNode) => WireField;
/** The client's tables (hello): its command struct and its act union. */
declare function clientTables(): {
    readonly commandTable: Uint8Array;
    readonly actTable: Uint8Array;
};
/** The server's `cmds` codec for one client's command table. */
declare function commandsCodec(commandTable: Readonly<Uint8Array>): BodyCodec;
/** The server's `act` codec for one client's act table. */
declare function actCodec(actTable: Readonly<Uint8Array>): BodyCodec;
/** The client's own `cmds` and `act` codecs: its layout both ways. */
declare function localCodecs(): {
    readonly commands: BodyCodec;
    readonly act: BodyCodec;
};
/** Split a message into records: unknown tags skipped, singletons once. */
declare function readMessage(bytes: Readonly<Uint8Array>): ReadMessage;
/** One record body through a codec, under the body's end rule. */
declare function decodeBody(codec: BodyCodec, span: Span): WireStruct;
/** A message holding one record, encoded by a codec. */
declare function encodeBody(codec: BodyCodec, tag: number, value: WireStruct): Uint8Array;
export { actCodec, entry, struct, clientTables, commandsCodec, decodeBody, encodeBody, localCodecs, readMessage, TAG_ACT, TAG_CMDS, TAG_EVENTS, TICK_BITS, TICK_BYTES, type BodyCodec, type WireEvent, };
