import { prepareTraffic, recording } from './benchmark-data.js';
import { POLICY } from './benchmark-stats.js';
import { measureTraffic, benchmarkSink } from './benchmark.js';
import { prepareV1Traffic } from './v1-traffic.js';
const held = {};
const NAMES = new Set(['walking', 'fight', 'ride', 'dense']);
async function get(name, file) {
    const response = await fetch(`/recordings/${name}/${file}`, {
        cache: 'no-store',
    });
    if (!response.ok) {
        throw new Error(`Recording HTTP ${String(response.status)}`);
    }
    return new Uint8Array(await response.arrayBuffer());
}
async function prepare(name, codec = 'v0') {
    if (!NAMES.has(name)) {
        throw new Error('Unknown benchmark recording');
    }
    delete held.traffic;
    const header = JSON.parse(new TextDecoder().decode(await get(name, 'manifest.json')));
    const read = async (file) => await get(name, file);
    held.traffic =
        codec === 'v1'
            ? prepareV1Traffic(await recording(header, read))
            : await prepareTraffic(header, read);
}
function measure() {
    const { traffic } = held;
    const isolated = Reflect.get(globalThis, 'crossOriginIsolated');
    if (isolated !== true || traffic === undefined) {
        throw new Error('Benchmark requires prepared traffic and an isolated high-resolution clock');
    }
    return measureTraffic(traffic);
}
function release() {
    delete held.traffic;
    benchmarkSink.value = undefined;
}
Object.assign(globalThis, {
    wireBenchmark: Object.freeze({
        policy: POLICY,
        sink: benchmarkSink,
        prepare,
        measure,
        release,
    }),
});
