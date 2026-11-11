import type { WireClass } from './grammar.ts';
/** The welcome's class table block. */
declare function encodeClassTables(classes: readonly WireClass[]): Uint8Array;
/** Read a server's class table block. */
declare function decodeClassTables(bytes: Readonly<Uint8Array>): readonly WireClass[];
export { decodeClassTables, encodeClassTables };
