/* oxlint-disable typescript/prefer-readonly-parameter-types -- frozen v0's captured inputs and FrameInput are mutable types */
import { encodeEvents } from '../../src/event-stream.js';
import { WIRE_EVENTS } from '../../src/events.js';
import { decodeBody, encodeBody, localBodyNode, localCodecs, TAG_ACT, TAG_CMDS, } from '../../src/game.js';
import { taggedRecord, taggedRecordBytes, varintBytes } from './tagged-bytes.js';
import { onlyRecord, packetOf } from './v1-packet.js';
import { readEvents, SERVER, SPAWNS } from './v1-session.js';
import { v1Act, v1Command, v1Event } from './v1-values.js';
const NONE = 0;
const LOCAL = localCodecs();
/** A record body's local fields, by tag. */
function bodyFields(tag) {
    const node = localBodyNode(tag);
    return node.kind === 'struct' ? node.fields : [];
}
/** An events message in the per-field-tag shape: tick, then each event. */
function taggedEvents(tick, events) {
    let body = varintBytes(tick);
    for (const event of events) {
        const record = WIRE_EVENTS.find((entry) => entry.name === event.event);
        body +=
            record === undefined
                ? NONE
                : taggedRecordBytes(record.fields, event.fields);
    }
    return taggedRecord(body);
}
/** A captured v0 command bundle as v1 work. */
function commandsPacket(value) {
    const bundle = {
        ackFrame: value.ackFrame,
        commands: value.commands.map((command) => v1Command(command)),
    };
    return packetOf('commands', {
        encode: () => encodeBody(LOCAL.commands, TAG_CMDS, bundle),
        decode: (bytes) => decodeBody(SERVER.commands, onlyRecord(bytes)),
        tagged: taggedRecordBytes(bodyFields(TAG_CMDS), bundle),
    });
}
/** A captured v0 act as v1 work. */
function actPacket(value) {
    const act = v1Act(value);
    return packetOf('act', {
        encode: () => encodeBody(LOCAL.act, TAG_ACT, act),
        decode: (bytes) => decodeBody(SERVER.act, onlyRecord(bytes)),
        tagged: taggedRecordBytes(bodyFields(TAG_ACT), act),
    });
}
/** A captured v0 events message as v1 work. */
function eventsPacket(value) {
    const events = value.events.map((event) => v1Event(event));
    return packetOf('events', {
        encode: () => encodeEvents(value.tick, events, SPAWNS),
        decode: (bytes) => readEvents(onlyRecord(bytes)),
        tagged: taggedEvents(value.tick, events),
    });
}
export { actPacket, commandsPacket, eventsPacket };
