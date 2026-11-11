/** The baseline tick of a full frame. */
const NO_BASELINE = 4_294_967_295;
const ZERO = 0;
const ONE = 1;
const TWO = 2;
const TICK_BITS = 32;
const CELL_BITS = 16;
const SEQ_BITS = 16;
const HANDLE_BITS = 16;
const COUNT_BITS = 16;
const LAW_BITS = 8;
const DOUBLE_BITS = 64;
const MAX_MASK_BITS = 32;
const fullMask = (fields) => fields >= MAX_MASK_BITS ? NO_BASELINE : TWO ** fields - ONE;
const ascending = (left, right) => left - right;
const bitSet = (mask, index) => Math.floor(mask / TWO ** index) % TWO === ONE;
/** A row's changed-field mask against its baseline row, if any. */
function rowMask(frame, at, base) {
    if (base.frame === undefined || base.at === undefined) {
        return fullMask(base.fields);
    }
    const offset = base.at - at;
    const held = base.frame.data;
    let mask = ZERO;
    for (let bit = ONE, index = ZERO; index < base.fields; index += ONE) {
        mask += frame.data[at + index] === held[offset + at + index] ? ZERO : bit;
        bit *= TWO;
    }
    return mask;
}
function writeOwner(writer, columns, owner) {
    // An index loop: `entries()` allocates per column, and this runs per frame (WB2).
    const count = columns.length;
    for (let index = ZERO; index < count; index += ONE) {
        const column = columns[index];
        if (column === undefined) {
            throw new RangeError(`A class has no owner column ${String(index)}`);
        }
        const { bits } = column;
        const value = owner[index] ?? ZERO;
        if (bits === DOUBLE_BITS) {
            writer.writeF64(value);
        }
        else {
            writer.write(value, bits);
        }
    }
}
function writeRide(writer, ride) {
    writer.write(ride === undefined ? ZERO : ONE, ONE);
    if (ride !== undefined) {
        writer.write(ride.law, LAW_BITS);
        for (const word of ride.words) {
            writer.writeF32(word);
        }
    }
}
export { ascending, bitSet, CELL_BITS, COUNT_BITS, DOUBLE_BITS, fullMask, HANDLE_BITS, LAW_BITS, NO_BASELINE, rowMask, SEQ_BITS, TICK_BITS, writeOwner, writeRide, };
