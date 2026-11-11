/* oxlint-disable typescript/prefer-readonly-parameter-types -- frozen v0's captured inputs and FrameInput are mutable types */
import { textBytes } from './frame-data.js';
import { readPacketInput } from './packet-input.js';
import { taggedFrameBytes } from './tagged-bytes.js';
import { frameCodec } from './v1-frames.js';
import { helloPacket, welcomePacket } from './v1-handshake.js';
import { actPacket, commandsPacket, eventsPacket } from './v1-records.js';
/** One captured v0 packet as v1 work. */
function v1Packet(text) {
    const input = readPacketInput(textBytes(text));
    switch (input.kind) {
        case 'hello': {
            return helloPacket(input.value);
        }
        case 'welcome': {
            return welcomePacket(input.value);
        }
        case 'commands': {
            return commandsPacket(input.value);
        }
        case 'act': {
            return actPacket(input.value);
        }
        case 'events': {
            return eventsPacket(input.value);
        }
        default: {
            throw new Error('Unknown captured packet');
        }
    }
}
/** A frame's bytes in the chosen shape. */
const frameSize = (frame, shape) => shape === 'tags'
    ? taggedFrameBytes(frame.seen, frame.bytes.byteLength)
    : frame.bytes.byteLength;
function frameTask(fields, frame, shape) {
    return {
        ...fields,
        stream: 'frame',
        bytes: frameSize(frame, shape),
        payload: {
            frame: {
                bytes: frame.bytes,
                encode: () => frame.encode().buffer,
                decode: frame.decode,
            },
        },
    };
}
function packetTask(fields, text, shape) {
    const v1 = v1Packet(text);
    const encode = () => v1.encode().buffer;
    return {
        ...fields,
        stream: v1.stream,
        bytes: shape === 'tags' ? v1.tagged : v1.bytes.byteLength,
        payload: {
            packet: {
                stream: v1.stream,
                encode,
                encodeWith: encode,
                decode: v1.decode,
            },
        },
    };
}
/** A captured session's traffic, as v1 work for `measureTraffic`; `tags` counts the per-field-tag shape's bytes instead. */
function prepareV1Traffic(session, shape = 'tables') {
    const frames = session.frames.map(frameCodec);
    const tasks = session.packets.map((packet) => {
        const fields = {
            direction: packet.direction,
            delivered: packet.delivered,
        };
        if (!('frame' in packet)) {
            return packetTask(fields, packet.packet.bytes, shape);
        }
        const frame = frames[packet.frame];
        if (frame === undefined) {
            throw new Error('Missing captured frame');
        }
        return frameTask(fields, frame, shape);
    });
    return {
        product: session.product,
        ticks: session.ticks,
        tasks,
        frameBytes: frames.map((frame) => frameSize(frame, shape)),
    };
}
export { prepareV1Traffic };
