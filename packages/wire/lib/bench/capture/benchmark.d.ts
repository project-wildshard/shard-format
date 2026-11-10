import type { PreparedTraffic } from './benchmark-data.ts';
import type { BenchmarkReading } from './benchmark-stats.ts';
declare const benchmarkSink: {
    value: unknown;
};
/** Framing/dispatch, per-handle lookups/masks, output copying/allocation and writer clearing remain timed. */
declare function measureTraffic(traffic: PreparedTraffic, now?: () => number): BenchmarkReading;
export { measureTraffic, benchmarkSink };
