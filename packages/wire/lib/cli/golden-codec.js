import { BitWriter } from '../frozen/v0/bits.js';
import { decodeCommands, encodeCommands } from '../frozen/v0/command.js';
import { decodeFrame, encodeFrame, WorldFrame } from '../frozen/v0/frame.js';
import { decodeAct, decodeEvents, decodeHello, decodeWelcome, encodeAct, encodeEvents, encodeHello, encodeWelcome, } from '../frozen/v0/messages.js';
import { V0_CLASSES } from '../frozen/v0/tables.js';
const HANDLE_OFFSET = 1;
const FIXTURE_ACTOR_HANDLE = 1;
const NO_HANDLE = 0;
const PLAYER_CLASS_INDEX = 0;
function missingBaseline() {
    // oxlint-disable-next-line unicorn/no-null -- Frozen FrameTable requires null for no baseline.
    return null;
}
function classAt(index) {
    const cls = V0_CLASSES[index];
    if (cls === undefined) {
        throw new Error('Missing frozen fixture class');
    }
    return cls;
}
function initial(cls) {
    const table = V0_CLASSES[cls];
    return table === undefined
        ? undefined
        : {
            bits: table.initial.map((column) => column.bits),
            text: table.text.length,
        };
}
function classOf(handle) {
    return V0_CLASSES[handle - HANDLE_OFFSET];
}
function ids(handle) {
    return handle === FIXTURE_ACTOR_HANDLE ? 'actor:1' : undefined;
}
function refs(id) {
    return id === 'actor:1' ? FIXTURE_ACTOR_HANDLE : NO_HANDLE;
}
function hello(bytes) {
    const decoded = decodeHello(bytes);
    return decoded === null ? undefined : encodeHello(new BitWriter(), decoded);
}
function welcome(bytes) {
    const decoded = decodeWelcome(bytes);
    return decoded === null ? undefined : encodeWelcome(new BitWriter(), decoded);
}
function events(bytes) {
    const decoded = decodeEvents(bytes, initial);
    return decoded === null
        ? undefined
        : encodeEvents(new BitWriter(), decoded.tick, decoded.events, initial);
}
function act(bytes) {
    const decoded = decodeAct(bytes);
    return decoded === null ? undefined : encodeAct(new BitWriter(), decoded);
}
function commands(bytes) {
    const decoded = decodeCommands(bytes, ids);
    return decoded === null
        ? undefined
        : encodeCommands(new BitWriter(), decoded, refs);
}
function frame(bytes) {
    const ownerClass = classAt(PLAYER_CLASS_INDEX);
    const decoded = decodeFrame(bytes, {
        ownerClass,
        classOf,
        baseline: missingBaseline,
    });
    if (decoded === null) {
        return undefined;
    }
    const world = new WorldFrame();
    world.reset(decoded.tick);
    for (const [handle, row] of decoded.rows) {
        world.data.set(row, world.claim(handle, row.length));
    }
    return encodeFrame(new BitWriter(), {
        frame: world,
        cell: decoded.cell,
        lastSeq: decoded.lastSeq,
        ownerClass,
        owner: decoded.owner,
        visible: new Set(decoded.rows.keys()),
        baseline: missingBaseline(),
        classOf,
        ...(decoded.ride === null
            ? {}
            : { ride: decoded.ride, rideWords: decoded.ride.length }),
    });
}
const codecs = { hello, welcome, events, act, commands, frame };
/** Replay only the fixed WS2 fixture contexts, never a game simulation. */
function reencodeGolden(stream, bytes) {
    const codec = codecs[stream];
    return codec === undefined ? undefined : codec(bytes);
}
export { reencodeGolden };
