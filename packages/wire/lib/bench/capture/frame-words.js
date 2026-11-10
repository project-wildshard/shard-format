import { array, literal, object, parse, string, unknown } from 'valibot';
import { parseFrameCapture } from './frame-data.js';
import { assertFrameReplay } from './frame-replay.js';
const VERSION = 1;
const ZERO = 0;
const ONE = 1;
const DictionarySchema = object({
    version: literal(VERSION),
    wordTable: array(string()),
    frames: unknown(),
});
function wordField(key) {
    return key === 'words' || key === 'owner' || key === 'ride';
}
/** Dictionary only the exact bit strings; no row, callback or packet is dropped. */
function packFrameWords(frames) {
    if (frames.length === ZERO) {
        throw new Error('A recording requires actual captured frames');
    }
    for (const frame of frames) {
        assertFrameReplay(frame);
    }
    const index = new Map();
    const wordTable = [];
    const text = JSON.stringify(frames, (key, value) => {
        if (!wordField(key) || value === undefined) {
            return value;
        }
        if (typeof value !== 'string') {
            throw new TypeError('Captured words must be bit strings');
        }
        const found = index.get(value);
        if (found !== undefined) {
            return found;
        }
        const at = wordTable.push(value) - ONE;
        index.set(value, at);
        return at;
    });
    const packed = JSON.parse(text);
    return { version: VERSION, wordTable, frames: packed };
}
/** Validate and replay every expanded frame before returning it to any timing run. */
function unpackFrameWords(value) {
    const record = parse(DictionarySchema, value);
    const text = JSON.stringify(record.frames, (key, item) => {
        if (!wordField(key)) {
            return item;
        }
        if (typeof item !== 'number' || !Number.isInteger(item) || item < ZERO) {
            throw new Error('Captured word reference must be an unsigned integer');
        }
        const word = record.wordTable[item];
        if (word === undefined) {
            throw new Error('Missing captured word reference');
        }
        return word;
    });
    const expanded = JSON.parse(text);
    const frames = parse(array(unknown()), expanded).map((frame) => parseFrameCapture(frame));
    if (frames.length === ZERO) {
        throw new Error('A recording requires actual captured frames');
    }
    for (const frame of frames) {
        assertFrameReplay(frame);
    }
    return frames;
}
export { packFrameWords, unpackFrameWords };
