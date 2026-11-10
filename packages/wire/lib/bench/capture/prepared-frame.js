import { BitWriter } from '../../frozen/v0/bits.js';
import { decodeFrame, encodeFrame } from '../../frozen/v0/frame.js';
import { assertDecodedFrame } from './decoded-frame.js';
import { bytesText, textBytes, unpackDoubles, unpackWords, } from './frame-data.js';
import { frozenClass, missingBaseline, world } from './frame-world.js';
const ZERO = 0;
function compact(snapshot) {
    const value = world(snapshot);
    const length = snapshot.rows.reduce((size, row) => size + frozenClass(row.classId).row.length, ZERO);
    value.data = value.data.slice(ZERO, length);
    return value;
}
function sources(record) {
    const rows = new Map();
    const identities = new Map();
    for (const call of record.rowFromCalls) {
        const identity = JSON.stringify(call.source);
        if (identities.has(call.handle) &&
            identities.get(call.handle) !== identity) {
            throw new Error('A captured rowFrom source changes during one frame');
        }
        identities.set(call.handle, identity);
        rows.set(call.handle, call.source === undefined ? missingBaseline() : compact(call.source));
    }
    return rows;
}
function dues(record) {
    const values = new Map();
    for (const call of record.dueCalls) {
        if (values.has(call.handle) && values.get(call.handle) !== call.value) {
            throw new Error('A captured due decision changes during one frame');
        }
        values.set(call.handle, call.value);
    }
    return values;
}
function senderBase(record) {
    const rows = sources(record);
    const base = record.baseline;
    if (base === undefined) {
        return missingBaseline();
    }
    return {
        frame: compact(base.frame),
        visible: new Set(base.visible),
        ...(base.hasRowFrom
            ? {
                rowFrom: (handle) => {
                    if (!rows.has(handle)) {
                        throw new Error('Uncaptured rowFrom handle');
                    }
                    return rows.get(handle) ?? missingBaseline();
                },
            }
            : {}),
    };
}
function inputOf(record) {
    const decisions = dues(record);
    const classes = new Map(record.classes.map((entry) => [
        entry.handle,
        frozenClass(entry.id),
    ]));
    return {
        frame: compact(record.frame),
        cell: record.cell,
        lastSeq: record.lastSeq,
        ownerClass: frozenClass(record.ownerClass),
        owner: unpackDoubles(record.owner),
        visible: new Set(record.visible),
        baseline: senderBase(record),
        classOf: (handle) => classes.get(handle),
        ...(record.hasDue
            ? {
                due: (handle) => {
                    const value = decisions.get(handle);
                    if (value === undefined) {
                        throw new Error('Uncaptured due handle');
                    }
                    return value;
                },
            }
            : {}),
        ...(record.ride === undefined ? {} : { ride: unpackDoubles(record.ride) }),
        ...(record.rideWords === undefined ? {} : { rideWords: record.rideWords }),
    };
}
/** Reconstruct the receiver baseline from the actual per-handle sources,
 * never substitute the global frame for an older held row. */
function receiverRows(record, base) {
    const rows = new Map(base.frame.rows
        .filter((row) => frozenClass(row.classId).row.length > ZERO)
        .map((row) => [
        row.handle,
        unpackWords(row.words),
    ]));
    if (base.hasRowFrom) {
        for (const call of record.rowFromCalls) {
            const row = call.source?.rows.find((entry) => entry.handle === call.handle);
            if (row === undefined) {
                rows.delete(call.handle);
            }
            else {
                rows.set(call.handle, unpackWords(row.words));
            }
        }
    }
    return rows;
}
function receiverBase(record) {
    const base = record.baseline;
    if (base === undefined) {
        return missingBaseline();
    }
    return {
        tick: base.frame.tick,
        baselineTick: ZERO,
        cell: record.cell,
        lastSeq: record.lastSeq,
        owner: new Float64Array(),
        ride: missingBaseline(),
        rows: receiverRows(record, base),
        fresh: new Set(),
    };
}
function assertPrepared(encode, expected) {
    const proof = new Uint8Array(encode(() => new BitWriter()));
    if (bytesText(proof) !== expected) {
        throw new Error('Prepared frame differs from real bytes');
    }
}
/** Inflate fixtures before timing. Timed encode still includes frozen framing,
 * per-handle dispatch, output allocation/copy and writer clearing. */
function prepareFrame(record) {
    const input = inputOf(record);
    const bytes = textBytes(record.bytes);
    const baseline = receiverBase(record);
    const table = {
        ownerClass: input.ownerClass,
        classOf: input.classOf,
        baseline: (tick) => {
            if (tick !== baseline?.tick) {
                throw new Error('Receiver baseline tick differs');
            }
            return baseline;
        },
    };
    const decode = () => {
        const result = decodeFrame(bytes, table);
        if (result === null) {
            throw new Error('Frozen frame benchmark decode refuses real bytes');
        }
        return result;
    };
    const encode = (writer) => encodeFrame(writer(), input);
    assertPrepared(encode, record.bytes);
    assertDecodedFrame(record, decode());
    return { bytes, encode, decode };
}
export { prepareFrame };
