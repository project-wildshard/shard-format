import { decodeCommands } from '../../frozen/v0/command.ts';
import { decodeAct, decodeEvents, decodeHello, decodeWelcome } from '../../frozen/v0/messages.ts';
import type { BitWriter } from '../../frozen/v0/bits.ts';
type PacketInput = {
    readonly kind: 'hello';
    readonly value: NonNullable<ReturnType<typeof decodeHello>>;
} | {
    readonly kind: 'commands';
    readonly value: NonNullable<ReturnType<typeof decodeCommands>>;
} | {
    readonly kind: 'act';
    readonly value: NonNullable<ReturnType<typeof decodeAct>>;
} | {
    readonly kind: 'welcome';
    readonly value: NonNullable<ReturnType<typeof decodeWelcome>>;
} | {
    readonly kind: 'events';
    readonly value: NonNullable<ReturnType<typeof decodeEvents>>;
};
type DeepRead<Value> = Value extends object ? {
    readonly [Key in keyof Value]: DeepRead<Value[Key]>;
} : Value;
/** Retain parsed sender input outside timing; timed encoding still selects its codec here. */
declare function encodePacketInput(input: DeepRead<PacketInput>, shared: () => BitWriter): ArrayBuffer;
/** Actual common prefix dispatch stays inside every timed receiver operation. */
declare function decodePacketValue(bytes: Readonly<Uint8Array>): unknown;
declare function readPacketInput(bytes: Readonly<Uint8Array>): PacketInput;
export { encodePacketInput, decodePacketValue, readPacketInput };
