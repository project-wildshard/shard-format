import type { WireField } from '../src/grammar.ts';
/** One field: `name:form`, or `name?:form` when optional. */
declare function renderField(field: WireField): string;
/** A command's top-level struct flattens into dotted paths, as WS2 wrote it. */
declare function renderCommandField(field: WireField, prefix: string): readonly string[];
/** A baseline form split into its top-level fields. */
declare function splitForm(form: string): readonly string[];
/** What a comparison kept, what is new, and what is wrong. */
interface Classification {
    readonly kept: number;
    readonly added: readonly string[];
    readonly problems: readonly string[];
}
/**
 * Compare one baseline body with v1's rendering of it: each v0 field is kept,
 * framing alone, or a problem; each v1 field no v0 field matched is added.
 */
declare function classifyTokens(space: string, old: readonly string[], now: readonly string[]): Classification;
export { classifyTokens, renderCommandField, renderField, splitForm, type Classification, };
