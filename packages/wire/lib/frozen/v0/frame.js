// P1-E5.2 (E5-REPLICATION §3.3): the world frame and its per-client delta, Quake 3 / Source style. The server builds one
// quantised frame per snapshot tick, keeps the last 32, and encodes each client's frame against the last one that
// client acked. State needs no reliable channel: a lost frame heals at the next acked one.
import { BitReader, bitsToFloat, floatToBits, NetDecodeError } from './bits.js';
import { MSG_FRAME } from './messages.js';
/** The baseline tick of a full frame. */
export const NO_BASELINE = 0xffffffff;
/** World frames the server keeps: about a second at 30 Hz. An ack older than this gets a full frame. */
export const FRAME_RING = 32;
/** One snapshot tick's quantised rows, flat, reused from the ring so a frame allocates nothing once warm. */
export class WorldFrame {
    tick = -1;
    data = new Uint32Array(1024);
    used = 0;
    offsets = new Map();
    /** Empty this slot for a new tick. */
    reset(tick) { this.tick = tick; this.used = 0; this.offsets.clear(); }
    /** Reserve one handle's row; the caller fills `length` values from the returned offset. */
    claim(handle, length) {
        const at = this.used;
        this.used += length;
        if (this.used > this.data.length) {
            const next = new Uint32Array(Math.max(this.data.length * 2, this.used));
            next.set(this.data);
            this.data = next;
        }
        this.offsets.set(handle, at);
        return at;
    }
    /** Where a handle's row starts, or undefined if it was not in this frame. */
    offset(handle) { return this.offsets.get(handle); }
    /** Every handle in this frame. */
    handles() { return this.offsets.keys(); }
}
/** The last FRAME_RING world frames. */
export class WorldFrameRing {
    slots = Array.from({ length: FRAME_RING }, () => new WorldFrame());
    next = 0;
    /** The oldest slot, emptied for `tick`. */
    claim(tick) {
        const slot = this.slots[this.next];
        if (slot === undefined)
            throw new Error('Empty frame ring');
        this.next = (this.next + 1) % FRAME_RING;
        slot.reset(tick);
        return slot;
    }
    /** The frame of `tick` if it is still held. */
    at(tick) { return this.slots.find(slot => slot.tick === tick) ?? null; }
}
const fullMask = (fields) => fields >= 32 ? 0xffffffff : 2 ** fields - 1;
const ascending = (a, b) => a - b;
function rowMask(frame, at, base, baseAt, fields) {
    if (base === null || baseAt === undefined)
        return fullMask(fields);
    let mask = 0;
    for (let index = 0; index < fields; index++)
        if (frame.data[at + index] !== base.data[baseAt + index])
            mask += 2 ** index;
    return mask;
}
/** Write one client's frame: header, owner block, then only the rows that changed since its baseline. */
export function encodeFrame(writer, input) {
    const { frame, baseline, visible, classOf, due } = input, seen = baseline?.visible;
    /** The frame a handle's row is a delta against, or null for a whole row. */
    const baseOf = (handle) => baseline === null || seen?.has(handle) !== true ? null : baseline.rowFrom === undefined ? baseline.frame : baseline.rowFrom(handle);
    writer.write(MSG_FRAME, 8);
    writer.write(frame.tick, 32);
    writer.write(baseline?.frame.tick ?? NO_BASELINE, 32);
    writer.write(input.cell, 16);
    writer.write(input.lastSeq, 16);
    input.ownerClass.owner.forEach((column, index) => { if (column.kind === 'f64')
        writer.writeDouble(input.owner[index] ?? 0);
    else
        writer.write(input.owner[index] ?? 0, column.bits); });
    const rideWords = input.rideWords ?? 0;
    writer.writeBool(rideWords > 0);
    if (rideWords > 0) {
        writer.write(rideWords, 8);
        for (let index = 0; index < rideWords; index++)
            writer.write(floatToBits(input.ride?.[index] ?? 0), 32);
    }
    const changed = [], left = [];
    for (const handle of visible) {
        const cls = classOf(handle), at = frame.offset(handle);
        if (cls === undefined || at === undefined || cls.row.length === 0)
            continue; // a class with no row is only its spawn
        const base = baseOf(handle);
        if (base !== null && due?.(handle) === false) {
            left.push(handle);
            continue;
        }
        if (rowMask(frame, at, base, base?.offset(handle), cls.row.length) !== 0)
            changed.push(handle);
        else
            left.push(handle);
    }
    const gone = [];
    if (seen !== undefined)
        for (const handle of seen)
            if (!visible.has(handle))
                gone.push(handle);
    writer.write(changed.length + gone.length, 16);
    for (const handle of gone) {
        writer.write(handle, 16);
        writer.writeBool(true);
    }
    for (const handle of changed) {
        const cls = classOf(handle), at = frame.offset(handle);
        if (cls === undefined || at === undefined)
            continue;
        const base = baseOf(handle), mask = rowMask(frame, at, base, base?.offset(handle), cls.row.length);
        writer.write(handle, 16);
        writer.writeBool(false);
        writer.write(mask, cls.row.length);
        cls.row.forEach((column, index) => { if (Math.floor(mask / 2 ** index) % 2 === 1)
            writer.write(frame.data[at + index] ?? 0, column.bits); });
    }
    // P1-E5.3-F1: a row left out is one of two things. Due and unchanged is a true sample of something standing still; not due is a stale copy.
    left.sort(ascending);
    for (const handle of left)
        writer.writeBool(due?.(handle) !== false);
    return writer.finish();
}
function readFrame(reader, table) {
    if (reader.read(8) !== MSG_FRAME)
        throw new NetDecodeError('Not a frame');
    const tick = reader.read(32), baselineTick = reader.read(32), cell = reader.read(16), lastSeq = reader.read(16);
    const owner = new Float64Array(table.ownerClass.owner.length);
    table.ownerClass.owner.forEach((column, index) => { owner[index] = column.kind === 'f64' ? reader.readDouble() : reader.read(column.bits); });
    const ride = reader.readBool() ? new Float64Array(reader.read(8)) : null;
    if (ride !== null)
        for (let index = 0; index < ride.length; index++)
            ride[index] = bitsToFloat(reader.read(32));
    const base = baselineTick === NO_BASELINE ? null : table.baseline(baselineTick);
    if (baselineTick !== NO_BASELINE && base === null)
        return null; // not held any more: wait for the full frame that follows
    const rows = new Map(base?.rows), fresh = new Set(), count = reader.read(16);
    for (let index = 0; index < count; index++) {
        const handle = reader.read(16);
        if (reader.readBool()) {
            rows.delete(handle);
            continue;
        }
        const cls = table.classOf(handle);
        if (cls === undefined)
            return null; // its spawn has not arrived: the next delta against the last ack carries this row again
        const fields = cls.row.length, mask = reader.read(fields), previous = rows.get(handle);
        if (previous === undefined && mask !== fullMask(fields))
            throw new NetDecodeError('Delta row without a baseline');
        const row = previous === undefined ? new Uint32Array(fields) : previous.slice();
        cls.row.forEach((column, at) => { if (Math.floor(mask / 2 ** at) % 2 === 1)
            row[at] = reader.read(column.bits); });
        rows.set(handle, row);
        fresh.add(handle);
    }
    for (const handle of [...rows.keys()].sort(ascending))
        if (!fresh.has(handle) && reader.readBool())
            fresh.add(handle);
    reader.end();
    return { tick, baselineTick, cell, lastSeq, owner, ride, rows, fresh };
}
/** Decode a frame. Malformed bytes or a frame that cannot apply yet give null; nothing throws past this boundary. */
export function decodeFrame(bytes, table) {
    try {
        return readFrame(new BitReader(bytes), table);
    }
    catch (error) {
        if (error instanceof NetDecodeError)
            return null;
        throw error;
    }
}
