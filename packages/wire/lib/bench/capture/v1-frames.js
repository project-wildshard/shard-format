import { WIRE_CLASSES } from '../../src/classes.js';
import { classColumns } from '../../src/columns.js';
import { decodeFrameMessage, encodeFrame } from '../../src/frame-record.js';
import { decodeRideLawTables, encodeRideLawTables, } from '../../src/ride-tables.js';
import { MOUNT, RIDE_LAWS } from '../../src/rides.js';
/* oxlint-disable typescript/prefer-readonly-parameter-types -- frozen v0's FrameInput, DecodedFrame and captured frames are mutable types */
import { inputOf, receiverBase } from './prepared-frame.js';
// Bridge WS3's real captured frames (frozen v0 inputs) into v1 snapshot
// inputs, so the v1 codec replays real play: the same rows, owner blocks,
// rides, baselines, `rowFrom` sources and `due` decisions.
const NONE = 0;
/** The ride laws a receiver learns from the welcome: decoded, never local. */
const LAWS = new Map(decodeRideLawTables(encodeRideLawTables(RIDE_LAWS)).map((law) => [
    law.id,
    { id: law.id, words: law.fields.length },
]));
/** The v1 columns of every class, by name, compiled once. */
const COLUMNS = new Map(WIRE_CLASSES.map((entry) => [
    entry.name,
    classColumns(entry),
]));
/** The v1 columns of a class, by its name. */
function columnsNamed(name) {
    const columns = COLUMNS.get(name);
    if (columns === undefined) {
        throw new Error(`No v1 class ${name}`);
    }
    return columns;
}
/** The v1 columns of a class, by its v0 class's name. */
const columnsOf = (cls) => columnsNamed(cls.cls);
function baselineOf(input) {
    const { baseline } = input;
    if (baseline === null) {
        return undefined;
    }
    const { rowFrom } = baseline;
    return {
        frame: baseline.frame,
        visible: baseline.visible,
        ...(rowFrom === undefined
            ? {}
            : {
                rowFrom: (handle) => rowFrom(handle) ?? undefined,
            }),
    };
}
/** A v0 frame input as a v1 snapshot input. */
function snapshotInput(input) {
    const words = input.rideWords ?? NONE;
    return {
        frame: input.frame,
        cell: input.cell,
        lastSeq: input.lastSeq,
        ownerClass: columnsOf(input.ownerClass),
        owner: input.owner,
        ride: words > NONE && input.ride !== undefined
            ? { law: MOUNT.id, words: input.ride.slice(NONE, words) }
            : undefined,
        visible: input.visible,
        baseline: baselineOf(input),
        ...(input.due === undefined ? {} : { due: input.due }),
        classOf: (handle) => {
            const cls = input.classOf(handle);
            return cls === undefined ? undefined : columnsOf(cls);
        },
    };
}
/** A v0 receiver baseline as a v1 raw frame. */
function rawBase(base) {
    if (base === null) {
        return undefined;
    }
    const { ride, ...rest } = base;
    return {
        ...rest,
        ride: ride === null ? undefined : { law: MOUNT.id, words: ride },
    };
}
/** A captured frame's v1 encode and decode, compiled once; decode by a receiver on the same tables. */
function frameCodec(record) {
    const input = inputOf(record);
    const base = rawBase(receiverBase(record));
    const v1 = snapshotInput(input);
    const bytes = encodeFrame(v1);
    const table = {
        ownerClass: v1.ownerClass,
        classOf: v1.classOf,
        rideLaw: (id) => LAWS.get(id),
        baseline: () => base,
    };
    const raw = decodeFrameMessage(bytes, table);
    return {
        input,
        bytes,
        seen: { raw, base, owner: v1.ownerClass, classOf: v1.classOf },
        encode: () => encodeFrame(v1),
        decode: () => decodeFrameMessage(bytes, table),
    };
}
/** One captured frame encoded and decoded by v1, as a receiver on the same tables. */
function replay(record) {
    const codec = frameCodec(record);
    return { input: codec.input, raw: codec.decode() };
}
export { columnsNamed, columnsOf, frameCodec, rawBase, replay, snapshotInput, };
