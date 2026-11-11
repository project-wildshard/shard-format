import { ascending, CELL_BITS, COUNT_BITS, DOUBLE_BITS, fullMask, HANDLE_BITS, LAW_BITS, NO_BASELINE, SEQ_BITS, TICK_BITS, } from './snapshot.js';
import { WireDecodeError } from './wire-error.js';
const ZERO = 0;
const ONE = 1;
const TWO = 2;
/** A column a compiled class must hold; a hole is a bug, never zero bits. */
function columnAt(columns, index) {
    const column = columns[index];
    if (column === undefined) {
        throw new RangeError(`A class has no column ${String(index)}`);
    }
    return column;
}
function readOwner(reader, columns) {
    // Index loops here and in `readWords`: `entries()` allocates per column (WB2).
    const count = columns.owner.length;
    const owner = new Float64Array(count);
    for (let index = ZERO; index < count; index += ONE) {
        const { bits } = columnAt(columns.owner, index);
        owner[index] = bits === DOUBLE_BITS ? reader.readF64() : reader.read(bits);
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
// oxlint-disable-next-line max-statements -- the hot path, one loop for WB2's decode budget
function readWords(reading, columns, handle) {
    const fields = columns.row.length;
    const mask = reading.reader.read(fields);
    const previous = reading.rows.get(handle);
    if (previous === undefined && mask !== fullMask(fields)) {
        throw new WireDecodeError('A delta row has no baseline');
    }
    const row = previous === undefined ? new Uint32Array(fields) : new Uint32Array(previous);
    let rest = mask;
    for (let index = ZERO; rest > ZERO; index += ONE) {
        if (rest % TWO === ONE) {
            row[index] = reading.reader.read(columnAt(columns.row, index).bits);
        }
        rest = Math.floor(rest / TWO);
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
function baseFor(table, tick, cell) {
    if (tick === NO_BASELINE) {
        return { rows: new Map() };
    }
    // After a travel a held frame of the same tick is another cell's: missing.
    const base = table.baseline(tick);
    return base?.cell === cell ? base : undefined;
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
    const base = baseFor(table, header.baselineTick, header.cell);
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
