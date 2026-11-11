import type { ColdRecord, WireClass, WireNode, WireRecord } from './grammar.ts';
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
export { validateDescriptors, type DescriptorSet };
