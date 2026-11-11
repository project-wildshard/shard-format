import { decodeTable } from './table-read.js';
import { encodeTable } from './tables.js';
import { rideLawProblems } from './validate.js';
import { WireDecodeError } from './wire-error.js';
// WIRE-STABILITY 5.4: the server's ride laws travel in the welcome, and a
// receiver reads a ride's words only by the law the sender declared, never by
// its own copy, so a law that gains a word never misaligns a frame.
const ZERO = 0;
/** The welcome's ride law table block. */
function encodeRideLawTables(laws) {
    return encodeTable(laws.map((law) => ({
        id: law.id,
        name: law.name,
        node: { kind: 'struct', fields: law.fields },
    })));
}
/** Read a server's ride law table block, checked as local laws are. */
function decodeRideLawTables(bytes) {
    const laws = decodeTable(bytes, ZERO, bytes.length).map((entry) => ({
        id: entry.id,
        name: entry.name,
        fields: entry.node.kind === 'struct' ? entry.node.fields : [],
    }));
    const problems = rideLawProblems(laws);
    if (problems.length > ZERO) {
        throw new WireDecodeError(`A ride law table is unsound: ${problems.join('; ')}`);
    }
    return laws;
}
export { decodeRideLawTables, encodeRideLawTables };
