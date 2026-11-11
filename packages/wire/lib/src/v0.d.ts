import type { WireClass } from './grammar.ts';
/** One class's v0 canonical text, as engine's `schemaDescription` writes it. */
declare function v0Description(wireClass: WireClass): string;
/** Engine's `NET_SCHEMA_HASH` for these classes over the frozen v0 events. */
declare function v0SchemaHash(classes: readonly WireClass[]): number;
export { v0Description, v0SchemaHash };
