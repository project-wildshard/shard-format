import type { WireField, WireNode } from './grammar.ts';
/** One decoded or to-be-encoded value. */
type WireValue = number | boolean | string | undefined | readonly WireValue[] | WireStruct;
/** A struct's fields by name. */
interface WireStruct {
    readonly [name: string]: WireValue;
}
/** A union value: the arm's name and its fields. */
interface WireArmValue {
    readonly arm: string;
    readonly fields: WireStruct;
}
/** Every field of a struct at its default, frozen: decodes share it. */
declare function structDefaults(fields: readonly WireField[]): WireStruct;
/** What a receiver reads for a field its sender's table lacks. */
declare function defaultValue(node: WireNode): WireValue;
/** A value as a number; anything else is a sender bug. */
declare function asNumber(value: WireValue): number;
declare const isStruct: (value: WireValue) => value is WireStruct;
/** A value as a struct. */
declare function asStruct(value: WireValue): WireStruct;
/** A value as a list. */
declare function asList(value: WireValue): readonly WireValue[];
/** A value as a union's arm and fields. */
declare function asArm(value: WireValue): WireArmValue;
export { asArm, asList, asNumber, asStruct, defaultValue, isStruct, structDefaults, type WireArmValue, type WireStruct, type WireValue, };
