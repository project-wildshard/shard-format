import { ascending, bitSet, CELL_BITS, COUNT_BITS, HANDLE_BITS, NO_BASELINE, rowMask, SEQ_BITS, TICK_BITS, writeOwner, writeRide, } from './snapshot.js';
// WIRE-STABILITY 5.4: the server encodes one client's frame body in its own
// layout, as v0's `encodeFrame` did; the record framing goes around it. Each
// row's mask is computed once; the hot loops index arrays directly (WB2).
const ZERO = 0;
const ONE = 1;
/** The frame a handle's row is a delta against, or undefined for a whole row. */
function baseOf(input, handle) {
    const { baseline } = input;
    if (baseline?.visible.has(handle) !== true) {
        return undefined;
    }
    return baseline.rowFrom === undefined
        ? baseline.frame
        : baseline.rowFrom(handle);
}
/** A visible handle's row to send, or undefined when it is left out. */
function sentOf(input, handle, columns) {
    const at = input.frame.offset(handle);
    if (at === undefined) {
        return undefined;
    }
    const base = baseOf(input, handle);
    if (base !== undefined && input.due?.(handle) === false) {
        return undefined;
    }
    const fields = columns.row.length;
    const mask = rowMask(input.frame, at, {
        frame: base,
        at: base?.offset(handle),
        fields,
    });
    return mask === ZERO ? undefined : { handle, columns, at, mask };
}
/** The handles the baseline held that this frame no longer shows. */
function goneOf(input) {
    const gone = [];
    for (const handle of input.baseline?.visible ?? []) {
        if (!input.visible.has(handle)) {
            gone.push(handle);
        }
    }
    return gone;
}
/** A visible handle's columns, if it has a row in this frame. */
function rowed(input, handle) {
    const columns = input.classOf(handle);
    return columns !== undefined &&
        columns.row.length > ZERO &&
        input.frame.offset(handle) !== undefined
        ? columns
        : undefined;
}
/** Sort each visible handle into changed or left, and find the gone. */
function plan(input) {
    const changed = [];
    const left = [];
    for (const handle of input.visible) {
        const columns = rowed(input, handle);
        const sent = columns === undefined ? undefined : sentOf(input, handle, columns);
        if (sent !== undefined) {
            changed.push(sent);
        }
        else if (columns !== undefined) {
            left.push(handle);
        }
    }
    return { changed, left: left.toSorted(ascending), gone: goneOf(input) };
}
function writeRow(writer, input, sent) {
    const { row } = sent.columns;
    writer.write(sent.handle, HANDLE_BITS);
    writer.write(ZERO, ONE);
    writer.write(sent.mask, row.length);
    for (let index = ZERO; index < row.length; index += ONE) {
        const column = row[index];
        if (column !== undefined && bitSet(sent.mask, index)) {
            writer.write(input.frame.data[sent.at + index] ?? ZERO, column.bits);
        }
    }
}
function writeHeader(writer, input) {
    writer.write(input.frame.tick, TICK_BITS);
    writer.write(input.baseline?.frame.tick ?? NO_BASELINE, TICK_BITS);
    writer.write(input.cell, CELL_BITS);
    writer.write(input.lastSeq, SEQ_BITS);
    writeOwner(writer, input.ownerClass.owner, input.owner);
    writeRide(writer, input.ride);
}
/** Write one client's frame body. */
function encodeSnapshot(writer, input) {
    writeHeader(writer, input);
    const { changed, left, gone } = plan(input);
    writer.write(changed.length + gone.length, COUNT_BITS);
    for (const handle of gone) {
        writer.write(handle, HANDLE_BITS);
        writer.write(ONE, ONE);
    }
    for (const sent of changed) {
        writeRow(writer, input, sent);
    }
    // P1-E5.3-F1: a row left out is due and unchanged (fresh) or not due (stale).
    for (const handle of left) {
        writer.write(input.due?.(handle) === false ? ZERO : ONE, ONE);
    }
}
export { encodeSnapshot };
