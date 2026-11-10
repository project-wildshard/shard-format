import { unpackDoubles, unpackWords } from './frame-data.js';
import { frozenClass } from './frame-world.js';
const ZERO = 0;
function receiverRow(record, row) {
    const base = record.baseline;
    const due = record.dueCalls.find((call) => call.handle === row.handle);
    if (base === undefined ||
        !base.visible.includes(row.handle) ||
        due?.value !== false) {
        return unpackWords(row.words);
    }
    const source = base.hasRowFrom
        ? record.rowFromCalls.find((call) => call.handle === row.handle)
            ?.source
        : base.frame;
    const held = source?.rows.find((entry) => entry.handle === row.handle);
    return unpackWords(held?.words ?? row.words);
}
function assertRows(record, decoded) {
    const rows = record.frame.rows.filter((row) => frozenClass(row.classId).row.length > ZERO);
    if (decoded.rows.size !== rows.length) {
        throw new Error('Frozen frame decode changes the visible row count');
    }
    for (const row of rows) {
        const expected = receiverRow(record, row);
        const actual = decoded.rows.get(row.handle);
        if (actual === undefined ||
            actual.length !== expected.length ||
            actual.some((word, index) => word !== expected[index])) {
            throw new Error('Frozen frame decode changes an actual held row');
        }
    }
}
function assertOwner(record, decoded) {
    const owner = unpackDoubles(record.owner);
    if (owner.length !== decoded.owner.length ||
        owner.some((value, index) => !Object.is(value, decoded.owner[index]))) {
        throw new Error('Frozen frame decode changes the actual owner');
    }
    const count = record.rideWords ?? ZERO;
    if (count === ZERO ? decoded.ride !== null : decoded.ride?.length !== count) {
        throw new Error('Frozen frame decode changes the actual ride width');
    }
    if (record.ride !== undefined && decoded.ride !== null) {
        const ride = unpackDoubles(record.ride);
        if (decoded.ride.some((value, index) => !Object.is(value, Math.fround(ride[index] ?? ZERO)))) {
            throw new Error('Frozen frame decode changes the actual ride');
        }
    }
}
/** Validate real receiver state before measuring, including older held rows. */
function assertDecodedFrame(record, decoded) {
    if (decoded.tick !== record.frame.tick ||
        decoded.cell !== record.cell ||
        decoded.lastSeq !== record.lastSeq) {
        throw new Error('Frozen frame decode changes the actual header');
    }
    assertRows(record, decoded);
    assertOwner(record, decoded);
}
export { assertDecodedFrame };
