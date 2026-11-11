import { classColumns } from './columns.js';
import { WireDecodeError } from './wire-error.js';
import { wordCodec } from './words.js';
const MISSING = -1;
const RIDE_WORD_BITS = 32;
const same = (word) => word;
function slotFor(local, sender) {
    const from = sender.findIndex((column) => column.id === local.id);
    const mine = wordCodec(local.node);
    const theirs = sender[from];
    if (theirs === undefined) {
        return { from: MISSING, convert: same, fallback: mine.fallback };
    }
    const match = JSON.stringify(theirs.node) === JSON.stringify(local.node);
    const peer = wordCodec(theirs.node);
    return {
        from,
        convert: match
            ? same
            : (word) => mine.toWord(peer.toValue(word)),
        fallback: mine.fallback,
    };
}
const slots = (local, sender) => local.map((column) => slotFor(column, sender));
/** Refuse a sender table that lacks a field this receiver requires. */
function checkRequired(local, sender) {
    for (const field of local.fields) {
        const needed = field.required === true || field.predicted === true;
        const has = sender.fields.some((entry) => entry.id === field.id && entry.node.kind === field.node.kind);
        if (needed && !has) {
            throw new WireDecodeError(`The server's ${local.name} lacks required ${field.name}`);
        }
    }
}
/** Every sender class this receiver knows, projected by id. */
function projectClasses(sender, local) {
    const out = new Map();
    for (const theirs of sender) {
        const mine = local.find((entry) => entry.id === theirs.id);
        if (mine !== undefined) {
            checkRequired(mine, theirs);
            const localColumns = classColumns(mine);
            const senderColumns = classColumns(theirs);
            out.set(theirs.id, {
                local: localColumns,
                row: slots(localColumns.row, senderColumns.row),
                owner: slots(localColumns.owner, senderColumns.owner),
                initial: slots(localColumns.initial, senderColumns.initial),
            });
        }
    }
    return out;
}
/** A sender row (or owner block) in the receiver's layout. */
function projectRow(slotsOf, raw) {
    const out = new Float64Array(slotsOf.length);
    for (const [index, slot] of slotsOf.entries()) {
        const word = raw[slot.from];
        out[index] = word === undefined ? slot.fallback : slot.convert(word);
    }
    return out;
}
/** Ride words are f32 values: a word the sender lacks is not a word to guess. */
const rideColumns = (law) => law.fields.map((field) => ({
    id: field.id,
    bits: RIDE_WORD_BITS,
    node: field.node,
}));
/**
 * Each sender ride law this receiver knows: its word slots, and whether the
 * sender's law holds every one of the receiver's words. A client is never
 * seated on a mount whose law it can't read whole; the block stays raw.
 */
function projectRides(sender, local) {
    const out = new Map();
    for (const theirs of sender) {
        const mine = local.find((law) => law.id === theirs.id);
        if (mine !== undefined) {
            const words = slots(rideColumns(mine), rideColumns(theirs));
            const seated = words.every((slot) => slot.from !== MISSING);
            out.set(theirs.id, { seated, words });
        }
    }
    return out;
}
export { projectClasses, projectRides, projectRow, };
