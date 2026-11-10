interface Distribution {
    readonly count: number;
    readonly total: number;
    readonly mean: number;
    readonly p95: number;
}
interface CpuReading {
    readonly meanMs: number;
    readonly p95Ms: number;
    readonly sampled: Distribution;
    readonly streams: Readonly<Record<string, Distribution>>;
    readonly operations: number;
}
interface BytesReading {
    readonly product: string;
    readonly ticks: number;
    readonly frameBytes: Distribution;
    readonly steadyBytes: Readonly<Record<'up' | 'down', number>>;
    readonly handshakeBytes: Readonly<Record<'up' | 'down', number>>;
    readonly streams: Readonly<Record<string, {
        readonly packets: number;
        readonly bytes: number;
        readonly maxBytes: number;
        readonly delivered: number;
    }>>;
}
interface BenchmarkReading extends BytesReading {
    readonly encode: CpuReading;
    readonly decode: CpuReading;
}
interface Stability {
    readonly ok: boolean;
    readonly differences: Readonly<Record<string, number>>;
}
declare const POLICY: Readonly<{
    warmPasses: 16;
    meanPasses: 32;
    samplePasses: 32;
    minimumOperations: 4096;
    runs: 2;
    maximumDifferencePercent: 3;
}>;
declare function distribution(values: readonly number[]): Distribution;
declare function compareRuns(first: BenchmarkReading, second: BenchmarkReading): Stability;
export { POLICY, distribution, compareRuns, type Distribution, type CpuReading, type BytesReading, type BenchmarkReading, type Stability, };
