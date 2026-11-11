import type { WireField } from '../../src/grammar.ts';
import type { WireValue } from '../../src/values.ts';
import type { FrameSeen } from './v1-frames.ts';
/** The bytes a varint of `value` takes. */
declare function varintBytes(value: number): number;
/** A one-byte tag, then a delimited body. */
declare const taggedRecord: (body: number) => number;
/** A record (`cmds`, `act`, an event) in the per-field-tag shape, framed. */
declare function taggedRecordBytes(fields: readonly WireField[], value: WireValue): number;
/** A decoded v1 frame, as the per-field-tag shape would send it. */
declare function taggedFrameBytes(seen: FrameSeen, fallback: number): number;
export { taggedFrameBytes, taggedRecord, taggedRecordBytes, varintBytes };
