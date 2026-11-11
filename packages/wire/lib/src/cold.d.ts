import type { Span } from './bit-io.ts';
import type { ColdRecord } from './grammar.ts';
/** A cold field's value: a number, or bytes for text, tables and ids. */
type ColdValue = number | Readonly<Uint8Array>;
/** A cold record's fields by name; repeated fields hold every value. */
type ColdValues = Readonly<Partial<Record<string, ColdValue | readonly ColdValue[]>>>;
/** A cold record body: each present field, in declared order. */
declare function encodeCold(record: ColdRecord, values: ColdValues): Uint8Array;
/** Decode a cold record body, refusing what 5.1 refuses. */
declare function decodeCold(record: ColdRecord, span: Span): ColdValues;
export { decodeCold, encodeCold, type ColdValue, type ColdValues };
