import { WorldFrame } from '../../frozen/v0/frame.js';
import { V0_CLASSES } from '../../frozen/v0/tables.js';
import { packWords, unpackWords } from './frame-data.js';
const CLASSES = new Map(V0_CLASSES.map((entry) => [
    entry.id,
    entry,
]));
function frozenClass(id) {
    const entry = CLASSES.get(id);
    if (entry === undefined) {
        throw new Error(`Class ${String(id)} is not in frozen v0`);
    }
    return entry;
}
function snapshot(frame, handles, classes) {
    const rows = [];
    for (const handle of handles) {
        const at = frame.offset(handle);
        const id = classes.get(handle);
        if (id !== undefined && at !== undefined) {
            const end = at + frozenClass(id).row.length;
            rows.push({
                handle,
                classId: id,
                words: packWords(frame.data.slice(at, end)),
            });
        }
    }
    return { tick: frame.tick, rows };
}
function world(data) {
    const frame = new WorldFrame();
    frame.reset(data.tick);
    for (const row of data.rows) {
        const values = unpackWords(row.words);
        if (values.length !== frozenClass(row.classId).row.length) {
            throw new Error('Captured row width differs');
        }
        const offset = frame.claim(row.handle, values.length);
        frame.data.set(values, offset);
    }
    return frame;
}
function missingBaseline() {
    // oxlint-disable-next-line unicorn/no-null -- Frozen FrameInput requires null for no baseline.
    return null;
}
export { frozenClass, snapshot, world, missingBaseline, };
