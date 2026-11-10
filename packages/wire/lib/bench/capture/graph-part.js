import { integer, literal, maxValue, minValue, number, parse, pipe, regex, strictObject, string, } from 'valibot';
import { bytesText, textBytes } from './frame-data.js';
const ZERO = 0;
const ONE = 1;
const MAX_PART = 1_000_000;
const encoder = new TextEncoder();
const EnvelopeSchema = strictObject({
    codec: literal('deflate-json/1'),
    expandedBytes: pipe(number(), integer(), minValue(ONE), maxValue(MAX_PART)),
    data: pipe(string(), regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u)),
});
class BoundedBytes {
    chunks = [];
    size = ZERO;
    limit;
    constructor(limit) {
        this.limit = limit;
    }
    add(value) {
        if (this.size + value.length > this.limit) {
            throw new Error('Capture part exceeds its decompression budget');
        }
        this.chunks.push(Uint8Array.from(value));
        this.size += value.length;
    }
    finish() {
        const output = new Uint8Array(this.size);
        let offset = ZERO;
        for (const chunk of this.chunks) {
            output.set(chunk, offset);
            offset += chunk.length;
        }
        return output;
    }
}
async function consume(reader, output) {
    const next = await reader.read();
    if (next.done) {
        return;
    }
    output.add(next.value);
    await consume(reader, output);
}
async function transform(data, inflate, limit = MAX_PART) {
    const codec = inflate
        ? new DecompressionStream('deflate')
        : new CompressionStream('deflate');
    const stream = new Blob([Uint8Array.from(data).buffer])
        .stream()
        .pipeThrough(codec);
    const reader = stream.getReader();
    const output = new BoundedBytes(limit);
    try {
        await consume(reader, output);
        return output.finish();
    }
    catch (error) {
        await reader.cancel();
        throw error;
    }
    finally {
        reader.releaseLock();
    }
}
/** A JSON envelope keeps the complete dense fixture below the original 5 MB total. */
async function sealGraphPart(data) {
    if (data.length > MAX_PART) {
        throw new Error('Capture part exceeds its source budget');
    }
    const compressed = await transform(data, false);
    const value = {
        codec: 'deflate-json/1',
        expandedBytes: data.length,
        data: bytesText(compressed),
    };
    const encoded = encoder.encode(`${JSON.stringify(value)}\n`);
    if (encoded.length > MAX_PART) {
        throw new Error('Capture part exceeds its file budget');
    }
    return encoded;
}
/** Stream-bounded decompression precedes parsing any graph node or expanding its tree. */
async function openGraphPart(data, expected = MAX_PART) {
    if (data.length > MAX_PART) {
        throw new Error('Capture part exceeds its file budget');
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    const envelope = parse(EnvelopeSchema, JSON.parse(text));
    if (envelope.expandedBytes > expected) {
        throw new Error('Capture part exceeds its manifest expansion budget');
    }
    const expanded = await transform(textBytes(envelope.data), true, envelope.expandedBytes);
    if (expanded.length !== envelope.expandedBytes) {
        throw new Error('Capture part decompressed length differs');
    }
    return expanded;
}
export { sealGraphPart, openGraphPart };
