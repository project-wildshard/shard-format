import type { WireClass, WireNode } from './grammar.ts';
/** The wire major these descriptors belong to. */
declare const WIRE_MAJOR = 1;
/** The wire minor of the next release (`wire-v1.0.0`). */
declare const WIRE_MINOR = 0;
/** The changed-field mask is one 32-bit word (`MAX_ROW_FIELDS`). */
declare const MAX_ROW_FIELDS = 32;
type Json = string | number | boolean | null | readonly Json[] | JsonObject;
interface JsonObject {
    readonly [key: string]: Json;
}
/** A node's typed default: what a receiver reads when the sender lacks it. */
declare function nodeDefault(node: WireNode): Json;
/** A class's row: the `all` and `others` fields, which the mask covers. */
declare function rowFieldCount(wireClass: WireClass): number;
/** The whole lock, as data. */
declare function wireLock(): Json;
/** The committed text of `wire.lock.json`. */
declare function wireLockText(): string;
export { MAX_ROW_FIELDS, nodeDefault, rowFieldCount, WIRE_MAJOR, WIRE_MINOR, wireLock, wireLockText, type Json, };
