import type { PacketInput } from './packet-input.ts';
import type { V1Packet } from './v1-packet.ts';
type Input<Kind extends PacketInput['kind']> = Extract<PacketInput, {
    kind: Kind;
}>['value'];
/** A captured v0 command bundle as v1 work. */
declare function commandsPacket(value: Readonly<Input<'commands'>>): V1Packet;
/** A captured v0 act as v1 work. */
declare function actPacket(value: Readonly<Input<'act'>>): V1Packet;
/** A captured v0 events message as v1 work. */
declare function eventsPacket(value: Readonly<Input<'events'>>): V1Packet;
export { actPacket, commandsPacket, eventsPacket };
