import type { Span } from './bit-io.ts';
/** What a client says first: its minor, build, identity and tables. */
interface Hello {
    readonly minor: number;
    readonly build: string;
    readonly player: string;
    readonly name: string;
    readonly ledger: number;
    readonly capabilities: readonly number[];
    readonly commandTable: Readonly<Uint8Array>;
    readonly actTable: Readonly<Uint8Array>;
}
/** The server's tables; absent on a travel welcome with a held hash. */
interface ServerTables {
    readonly classTables: Readonly<Uint8Array>;
    readonly eventTables: Readonly<Uint8Array>;
    readonly rideLawTables: Readonly<Uint8Array>;
}
/** The server's seat for a client. */
interface Welcome {
    readonly minor: number;
    readonly build: string;
    readonly handle: number;
    readonly player: string;
    readonly tick: number;
    readonly cell: number;
    readonly simHz: number;
    readonly frameHz: number;
    readonly capabilities: readonly number[];
    readonly requiredCapabilities: readonly number[];
    readonly tableHash: number;
    readonly tables?: ServerTables;
}
/** A first message, read: a hello, or what to close with (5.5). */
type FirstMessage = {
    readonly kind: 'hello';
    readonly hello: Hello;
} | {
    readonly kind: 'reload' | 'retry' | 'refuse';
};
/** FNV-1a over table bytes: `tableHash` (5.3). It refuses nothing. */
declare function tableHash(blocks: readonly Readonly<Uint8Array>[]): number;
/** A v1 client's first message: bootstrap, then the hello record. */
declare function encodeHello(hello: Hello): Uint8Array;
/** Read a client's first message: the bootstrap bytes before any record. */
declare function decodeFirstMessage(bytes: Readonly<Uint8Array>): FirstMessage;
/** The welcome record, with its tables unless `tables` is absent. */
declare function encodeWelcome(welcome: Welcome): Uint8Array;
/** Read a welcome record's body. */
declare function decodeWelcome(span: Span): Welcome;
export { decodeFirstMessage, decodeWelcome, encodeHello, encodeWelcome, tableHash, type FirstMessage, type Hello, type ServerTables, type Welcome, };
