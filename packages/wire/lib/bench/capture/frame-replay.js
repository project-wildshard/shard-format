import { BitWriter } from '../../frozen/v0/bits.js';
import { encodeFrame } from '../../frozen/v0/frame.js';
import { bytesText, unpackDoubles } from './frame-data.js';
import { world, frozenClass, missingBaseline } from './frame-world.js';
const ZERO = 0;
const ONE = 1;
class ReplayCalls {
    record;
    rowIndex = ZERO;
    dueIndex = ZERO;
    constructor(record) {
        this.record = record;
    }
    rowFrom(handle) {
        const call = this.record.rowFromCalls[this.rowIndex];
        this.rowIndex += ONE;
        if (call === undefined || call.handle !== handle) {
            throw new Error('rowFrom capture call mismatch');
        }
        return call.source === undefined ? missingBaseline() : world(call.source);
    }
    due(handle) {
        const call = this.record.dueCalls[this.dueIndex];
        this.dueIndex += ONE;
        if (call === undefined || call.handle !== handle) {
            throw new Error('due capture call mismatch');
        }
        return call.value;
    }
    baseline() {
        const base = this.record.baseline;
        return base === undefined
            ? missingBaseline()
            : {
                frame: world(base.frame),
                visible: new Set(base.visible),
                ...(base.hasRowFrom
                    ? {
                        rowFrom: (handle) => this.rowFrom(handle),
                    }
                    : {}),
            };
    }
    assertConsumed() {
        if (this.rowIndex !== this.record.rowFromCalls.length ||
            this.dueIndex !== this.record.dueCalls.length) {
            throw new Error('Unused rowFrom/due capture calls');
        }
    }
}
function replayCapturedFrame(record) {
    const calls = new ReplayCalls(record);
    const classes = new Map(record.classes.map((entry) => [entry.handle, entry.id]));
    const result = encodeFrame(new BitWriter(), {
        frame: world(record.frame),
        cell: record.cell,
        lastSeq: record.lastSeq,
        ownerClass: frozenClass(record.ownerClass),
        owner: unpackDoubles(record.owner),
        visible: new Set(record.visible),
        baseline: calls.baseline(),
        classOf: (handle) => {
            const id = classes.get(handle);
            return id === undefined ? undefined : frozenClass(id);
        },
        ...(record.hasDue
            ? { due: (handle) => calls.due(handle) }
            : {}),
        ...(record.ride === undefined ? {} : { ride: unpackDoubles(record.ride) }),
        ...(record.rideWords === undefined ? {} : { rideWords: record.rideWords }),
    });
    calls.assertConsumed();
    return result;
}
function assertFrameReplay(record) {
    const bytes = new Uint8Array(replayCapturedFrame(record));
    if (bytesText(bytes) !== record.bytes) {
        throw new Error('Frozen v0 frame replay differs from real bytes');
    }
}
export { replayCapturedFrame, assertFrameReplay };
