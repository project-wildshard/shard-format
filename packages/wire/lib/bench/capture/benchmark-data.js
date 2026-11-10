import { BitWriter } from '../../frozen/v0/bits.js';
import { POLICY, distribution } from './benchmark-stats.js';
import { bytesText, textBytes } from './frame-data.js';
import { preparePacket } from './packet-replay.js';
import { prepareFrame } from './prepared-frame.js';
import { readSessionArchive } from './session-archive.js';
import { readGraphSession } from './session-graph.js';
const ZERO = 0;
const ONE = 1;
const DOWN_CAPACITY = 4096;
const UP_CAPACITY = 1024;
const HANDSHAKE = new Set(['hello', 'welcome']);
async function recording(header, read) {
    return typeof header === 'object' &&
        header !== null &&
        'format' in header &&
        header.format === 'wire-capture-graph/1'
        ? await readGraphSession(header, read)
        : await readSessionArchive(header, read);
}
function assertActual(actual, expected) {
    if (bytesText(actual) !== bytesText(expected)) {
        throw new Error('Shared-writer frozen replay differs before benchmark');
    }
}
/** Mandatory complete byte equality before any timing consumer receives tasks. */
async function prepareTraffic(header, read) {
    const session = await recording(header, read);
    const frames = session.frames.map(prepareFrame);
    const down = new BitWriter(DOWN_CAPACITY);
    const up = new BitWriter(UP_CAPACITY);
    const tasks = session.packets.map((packet) => {
        const source = 'frame' in packet ? frames[packet.frame] : preparePacket(packet.packet);
        if (source === undefined) {
            throw new Error('Missing actual frame packet');
        }
        const bytes = 'frame' in packet
            ? frames[packet.frame]?.bytes
            : textBytes(packet.packet.bytes);
        if (bytes === undefined) {
            throw new Error('Missing actual packet bytes');
        }
        const encode = 'encodeWith' in source ? source.encodeWith : source.encode;
        const actual = new Uint8Array(encode(() => (packet.direction === 'down' ? down : up)));
        assertActual(actual, bytes);
        return {
            direction: packet.direction,
            delivered: packet.delivered,
            stream: 'stream' in source ? source.stream : 'frame',
            bytes: bytes.byteLength,
            payload: 'encodeWith' in source ? { packet: source } : { frame: source },
        };
    });
    if (tasks.length * POLICY.meanPasses < POLICY.minimumOperations) {
        throw new Error('Capture has too few operations for the fixed benchmark');
    }
    return {
        product: session.product,
        ticks: session.ticks,
        tasks,
        frameBytes: frames.map((frame) => frame.bytes.byteLength),
    };
}
/** Mutable accounting stays private; consumers receive read-only plain values. */
class ByteBook {
    steady = { up: ZERO, down: ZERO };
    handshake = { up: ZERO, down: ZERO };
    streams = {};
    add(task) {
        const totals = HANDSHAKE.has(task.stream) ? this.handshake : this.steady;
        totals[task.direction] += task.bytes;
        const key = `${task.direction}:${task.stream}`;
        const row = this.streams[key] ?? {
            packets: ZERO,
            bytes: ZERO,
            maxBytes: ZERO,
            delivered: ZERO,
        };
        row.packets += ONE;
        row.bytes += task.bytes;
        row.maxBytes = Math.max(row.maxBytes, task.bytes);
        row.delivered += Number(task.delivered);
        this.streams[key] = row;
    }
    reading(traffic) {
        return {
            product: traffic.product,
            ticks: traffic.ticks,
            frameBytes: distribution(traffic.frameBytes),
            steadyBytes: this.steady,
            handshakeBytes: this.handshake,
            streams: this.streams,
        };
    }
}
function trafficBytes(traffic) {
    const book = new ByteBook();
    for (const task of traffic.tasks) {
        book.add(task);
    }
    return book.reading(traffic);
}
export { prepareTraffic, trafficBytes, DOWN_CAPACITY, UP_CAPACITY, };
