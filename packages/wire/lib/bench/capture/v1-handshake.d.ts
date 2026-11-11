import type { PacketInput } from './packet-input.ts';
import type { V1Packet } from './v1-packet.ts';
type Input<Kind extends PacketInput['kind']> = Extract<PacketInput, {
    kind: Kind;
}>['value'];
/** A captured v0 hello as v1 work. */
declare function helloPacket(value: Readonly<Input<'hello'>>): V1Packet;
/** A captured v0 welcome as v1 work, with the whole table set. */
declare function welcomePacket(value: Readonly<Input<'welcome'>>): V1Packet;
export { helloPacket, welcomePacket };
