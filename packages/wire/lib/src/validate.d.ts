import type { ColdRecord, WireArm, WireClass, WireNode, WireRecord } from './grammar.ts';
import type { Identified } from './node-checks.ts';
/** A descriptor set: everything one wire major declares. */
interface DescriptorSet {
    readonly messages: readonly Identified[];
    readonly cold: readonly ColdRecord[];
    readonly records: readonly WireRecord[];
    readonly events: readonly WireRecord[];
    readonly acts: WireNode;
    readonly command: WireNode;
    readonly classes: readonly WireClass[];
}
/** Everything wrong with a descriptor set; empty when it is sound. */
declare function validateDescriptors(set: DescriptorSet): readonly string[];
/** Everything wrong with one class, as a peer's class table must be checked. */
declare function classProblems(wireClass: WireClass): readonly string[];
/** Every ride law's words are f32s, so a frame carries them as v0 did. */
declare function rideLawProblems(laws: readonly WireArm[]): readonly string[];
/** Everything wrong with the descriptors this package ships. */
declare function validateWire(): readonly string[];
export { classProblems, rideLawProblems, validateDescriptors, validateWire, type DescriptorSet, };
