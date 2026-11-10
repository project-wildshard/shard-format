// Fixed before timing. Never adapt samples or select the fastest result.
const POLICY = Object.freeze({
    warmPasses: 16,
    meanPasses: 32,
    samplePasses: 32,
    minimumOperations: 4096,
    runs: 2,
    maximumDifferencePercent: 3,
});
const ZERO = 0;
const ONE = 1;
const P95 = 0.95;
const PERCENT = 100;
function distribution(values) {
    if (values.length === ZERO) {
        return { count: ZERO, total: ZERO, mean: ZERO, p95: ZERO };
    }
    const sorted = values.toSorted((left, right) => left - right);
    const total = values.reduce((sum, value) => sum + value, ZERO);
    return {
        count: values.length,
        total,
        mean: total / values.length,
        p95: sorted[Math.ceil(values.length * P95) - ONE] ?? ZERO,
    };
}
function bytesOfReading(value) {
    return {
        product: value.product,
        ticks: value.ticks,
        frameBytes: value.frameBytes,
        steadyBytes: value.steadyBytes,
        handshakeBytes: value.handshakeBytes,
        streams: value.streams,
    };
}
function difference(before, after) {
    if (!(before > ZERO &&
        after > ZERO &&
        Number.isFinite(before) &&
        Number.isFinite(after))) {
        throw new Error('Invalid primary CPU timing');
    }
    return (Math.abs(after - before) / before) * PERCENT;
}
function compareRuns(first, second) {
    if (JSON.stringify(bytesOfReading(first)) !==
        JSON.stringify(bytesOfReading(second))) {
        throw new Error('Two timing runs changed their actual traffic bytes');
    }
    const modes = ['encode', 'decode'];
    const keys = ['meanMs', 'p95Ms'];
    const differences = Object.fromEntries(modes.flatMap((mode) => keys.map((key) => [
        `${mode}.${key}`,
        difference(first[mode][key], second[mode][key]),
    ])));
    return {
        ok: Object.values(differences).every((value) => value < POLICY.maximumDifferencePercent),
        differences,
    };
}
export { POLICY, distribution, compareRuns, };
