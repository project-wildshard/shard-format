import { compileDecoder, compileEncoder } from './codec.js';
import { WireDecodeError } from './wire-error.js';
const TEXT = { kind: 'text', maxBytes: 255 };
const writeText = compileEncoder(TEXT);
const readText = compileDecoder(TEXT, TEXT);
const NONE = 0;
const textOf = (value) => typeof value === 'string' ? value : '';
const listOf = (value) => Array.isArray(value) ? value : [];
/** Spawn columns by the sender's classes, keyed by class id. */
function spawnColumns(classOf) {
    const columnsOf = (fields) => {
        const columns = classOf(typeof fields['cls'] === 'number' ? fields['cls'] : NONE);
        if (columns === undefined) {
            throw new WireDecodeError('A spawn names a class its sender table lacks');
        }
        return columns;
    };
    return {
        write: (writer, fields) => {
            const columns = columnsOf(fields);
            const initial = listOf(fields['initial']);
            for (const [index, column] of columns.initial.entries()) {
                const word = initial[index];
                writer.write(typeof word === 'number' ? word : NONE, column.bits);
            }
            for (const [index] of columns.text.entries()) {
                writeText(writer, listOf(fields['text'])[index] ?? '');
            }
        },
        read: (reader, fields) => {
            const columns = columnsOf(fields);
            const tail = {
                initial: columns.initial.map((column) => reader.read(column.bits)),
                text: columns.text.map(() => textOf(readText(reader))),
            };
            return { ...fields, initial: tail.initial, text: tail.text };
        },
    };
}
export { spawnColumns };
