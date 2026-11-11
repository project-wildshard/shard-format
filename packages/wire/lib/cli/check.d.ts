import type { Classification } from './forms.ts';
interface TaggedEntry {
    readonly tag: number;
    readonly name: string;
    readonly form: string;
}
/** A baseline field: its id, name and the v0 form keys. */
interface BaselineFieldForm {
    readonly id: number;
    readonly name: string;
    readonly [key: string]: unknown;
}
interface BaselineClass {
    readonly v0Index: number;
    readonly v1Id: number;
    readonly name: string;
    readonly fields: readonly BaselineFieldForm[];
}
/** The WS2 baseline lock, as far as classification reads it. */
interface BaselineLock {
    readonly descriptions: readonly string[];
    readonly classes: readonly BaselineClass[];
    readonly messages: readonly TaggedEntry[];
    readonly events: readonly TaggedEntry[];
    readonly acts: readonly TaggedEntry[];
    readonly command: {
        readonly fields: readonly string[];
    };
}
/** Compare the descriptors with the WS2 v0 baseline. */
declare function classifyAgainstBaseline(baseline: BaselineLock): Classification;
/** Every reason `wire check` fails, plus what it classified. */
declare function checkWire(committedLock: string, baseline: unknown): Classification;
export { checkWire, classifyAgainstBaseline };
