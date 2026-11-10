import { array, boolean, literal, minLength, minValue, number, parse, picklist, pipe, strictObject, string, union, unknown, integer, } from 'valibot';
import { unpackFrameWords } from './frame-words.js';
import { preparePacket } from './packet-replay.js';
const VERSION = 1;
const ENGINE = 'cfd668102efcb7c10a6fb57d3021c1f3d23c37a5';
const ZERO = 0;
const ONE = 1;
const natural = pipe(number(), integer(), minValue(ZERO));
const positive = pipe(natural, minValue(ONE));
const packetFields = {
    tick: natural,
    direction: picklist(['up', 'down']),
    channel: picklist(['reliable', 'unreliable']),
    delivered: boolean(),
};
const PayloadSchema = strictObject({ bytes: string() });
const PacketSchema = union([
    strictObject({ ...packetFields, frame: natural }),
    strictObject({ ...packetFields, packet: PayloadSchema }),
]);
const PackedSchema = strictObject({
    version: literal(VERSION),
    wordTable: array(string()),
    frames: array(unknown()),
});
const packetList = pipe(array(PacketSchema), minLength(ONE));
const SessionSchema = strictObject({
    version: literal(VERSION),
    engine: literal(ENGINE),
    product: pipe(string(), minLength(ONE)),
    ticks: positive,
    frames: PackedSchema,
    packets: packetList,
});
class PacketReplayGuard {
    references = new Set();
    ticks;
    frames;
    constructor(ticks, frames) {
        this.ticks = ticks;
        this.frames = frames;
    }
    observe(packet) {
        if (packet.tick >= this.ticks) {
            throw new Error('Packet lies outside the recording interval');
        }
        if ('frame' in packet) {
            this.frame(packet);
        }
        else {
            preparePacket(packet.packet);
        }
    }
    frame(packet) {
        if (packet.direction !== 'down' ||
            packet.frame >= this.frames ||
            this.references.has(packet.frame)) {
            throw new Error('Invalid or repeated captured frame reference');
        }
        this.references.add(packet.frame);
    }
    complete() {
        if (this.references.size !== this.frames) {
            throw new Error('A captured frame has no actual transport packet');
        }
    }
}
/** Validate every actual stream and per-handle callback before timing or storage. */
function parseStoredSession(value) {
    const source = parse(SessionSchema, value);
    const frames = unpackFrameWords(source.frames);
    const guard = new PacketReplayGuard(source.ticks, frames.length);
    for (const packet of source.packets) {
        guard.observe(packet);
    }
    guard.complete();
    return source;
}
/** Expanded values remain opaque, bit-exact snapshots from frozen-v0 replay. */
function parseSession(value) {
    const source = parseStoredSession(value);
    return { ...source, frames: unpackFrameWords(source.frames) };
}
export { VERSION, ENGINE, parseStoredSession, parseSession, };
