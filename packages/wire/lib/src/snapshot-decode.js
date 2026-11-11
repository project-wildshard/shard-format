import { ascending, bitSet, CELL_BITS, COUNT_BITS, DOUBLE_BITS, fullMask, HANDLE_BITS, LAW_BITS, NO_BASELINE, SEQ_BITS, TICK_BITS, } from './snapshot.js';
import { WireDecodeError } from './wire-error.js';
const ZERO = 0;
const ONE = 1;
function readOwner(reader, columns) {
    const owner = new Float64Array(columns.owner.length);
    for (const [index, column] of columns.owner.entries()) {
        owner[index] =
            column.bits === DOUBLE_BITS ? reader.readF64() : reader.read(column.bits);
    }
    return owner;
}
function readRide(reader, table) {
    if (reader.read(ONE) === ZERO) {
        return undefined;
    }
    const law = table.rideLaw(reader.read(LAW_BITS));
    if (law === undefined) {
        throw new WireDecodeError('A ride names a law its sender table lacks');
    }
    const words = new Float64Array(law.words);
    for (let index = ZERO; index < law.words; index += ONE) {
        words[index] = reader.readF32();
    }
    return { law: law.id, words };
}
/** A changed row's new words over its previous ones, if any. */
function readWords(reading, columns, handle) {
    const fields = columns.row.length;
    const mask = reading.reader.read(fields);
    const previous = reading.rows.get(handle);
    if (previous === undefined && mask !== fullMask(fields)) {
        throw new WireDecodeError('A delta row has no baseline');
    }
    const row = Uint32Array.from(previous ?? new Uint32Array(fields));
    for (const [index, column] of columns.row.entries()) {
        if (bitSet(mask, index)) {
            row[index] = reading.reader.read(column.bits);
        }
    }
    return row;
}
/** Read one changed or gone row; false when its spawn hasn't arrived. */
function readRow(reading, handle) {
    if (reading.reader.read(ONE) === ONE) {
        reading.rows.delete(handle);
        return true;
    }
    const columns = reading.table.classOf(handle);
    if (columns === undefined) {
        return false;
    }
    reading.rows.set(handle, readWords(reading, columns, handle));
    reading.fresh.add(handle);
    return true;
}
/** The changed and gone rows; false when one cannot apply yet. */
function readRows(reading) {
    const count = reading.reader.read(COUNT_BITS);
    for (let index = ZERO; index < count; index += ONE) {
        if (!readRow(reading, reading.reader.read(HANDLE_BITS))) {
            return false;
        }
    }
    return true;
}
function readFreshness(reading) {
    for (const handle of [...reading.rows.keys()].toSorted(ascending)) {
        if (!reading.fresh.has(handle) && reading.reader.read(ONE) === ONE) {
            reading.fresh.add(handle);
        }
    }
}
/** The baseline a frame names: none, held, or missing (undefined). */
function baseFor(table, tick) {
    return tick === NO_BASELINE ? { rows: new Map() } : table.baseline(tick);
}
/** Decode one frame body raw, or undefined when it cannot apply yet. */
function decodeSnapshot(reader, table) {
    const header = {
        tick: reader.read(TICK_BITS),
        baselineTick: reader.read(TICK_BITS),
        cell: reader.read(CELL_BITS),
        lastSeq: reader.read(SEQ_BITS),
        owner: readOwner(reader, table.ownerClass),
        ride: readRide(reader, table),
    };
    const base = baseFor(table, header.baselineTick);
    if (base === undefined) {
        return undefined;
    }
    const reading = {
        reader,
        table,
        rows: new Map(base.rows),
        fresh: new Set(),
    };
    if (!readRows(reading)) {
        return undefined;
    }
    readFreshness(reading);
    reader.end();
    return { ...header, rows: reading.rows, fresh: reading.fresh };
}
export { decodeSnapshot };
