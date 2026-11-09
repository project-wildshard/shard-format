import { bytesText, packDoubles, parseFrameCapture } from './frame-data.js';
import { assertFrameReplay } from './frame-replay.js';
import { frozenClass, snapshot } from './frame-world.js';
/** Tee actual callback calls; never re-evaluate rowFrom or due after encode. */
class FrameTrace {
    classes = new Map();
    rows = [];
    dues = [];
    recordClass(handle, cls) {
        if (cls !== undefined) {
            const expected = frozenClass(cls.id);
            if (cls.row.length !== expected.row.length ||
                cls.row.some((column, index) => column.bits !== expected.row[index]?.bits)) {
                throw new Error('Captured class differs from frozen v0');
            }
            this.classes.set(handle, cls.id);
        }
        return cls;
    }
    recordRowFrom(handle, frame) {
        this.rows.push({
            handle,
            ...(frame === null
                ? {}
                : { source: snapshot(frame, [handle], this.classes) }),
        });
        return frame;
    }
    recordDue(handle, value) {
        this.dues.push({ handle, value });
        return value;
    }
    record(input, bytes) {
        const base = input.baseline;
        return {
            frame: snapshot(input.frame, [...input.visible], this.classes),
            cell: input.cell,
            lastSeq: input.lastSeq,
            ownerClass: input.ownerClass.id,
            owner: packDoubles(input.owner),
            visible: [...input.visible],
            ...(input.ride === undefined ? {} : { ride: packDoubles(input.ride) }),
            ...(input.rideWords === undefined ? {} : { rideWords: input.rideWords }),
            ...(base === null
                ? {}
                : {
                    baseline: {
                        frame: snapshot(base.frame, [...base.visible], this.classes),
                        visible: [...base.visible],
                        hasRowFrom: base.rowFrom !== undefined,
                    },
                }),
            classes: [...this.classes].map(([handle, id]) => ({ handle, id })),
            hasDue: input.due !== undefined,
            rowFromCalls: this.rows,
            dueCalls: this.dues,
            bytes: bytesText(new Uint8Array(bytes)),
        };
    }
    /** Mandatory byte oracle before a record can reach the recording or gate. */
    finish(input, bytes) {
        // Exercise the actual JSON recording boundary, preserving doubles as bits.
        const text = JSON.stringify(this.record(input, bytes));
        const record = parseFrameCapture(JSON.parse(text));
        assertFrameReplay(record);
        return record;
    }
}
export { FrameTrace };
