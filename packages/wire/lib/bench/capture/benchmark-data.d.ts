import { BitWriter } from '../../frozen/v0/bits.ts';
import type { BytesReading } from './benchmark-stats.ts';
interface Task {
    readonly stream: string;
    readonly direction: 'up' | 'down';
    readonly bytes: number;
    readonly delivered: boolean;
    readonly encode: (writer: () => BitWriter) => ArrayBuffer;
    readonly decode: () => unknown;
}
interface PreparedTraffic {
    readonly product: string;
    readonly ticks: number;
    readonly tasks: readonly Task[];
    readonly frameBytes: readonly number[];
}
declare const DOWN_CAPACITY = 4096;
declare const UP_CAPACITY = 1024;
/** Mandatory complete byte equality before any timing consumer receives tasks. */
declare function prepareTraffic(header: unknown, read: (file: string) => Promise<Readonly<Uint8Array>>): Promise<PreparedTraffic>;
declare function trafficBytes(traffic: PreparedTraffic): BytesReading;
export { prepareTraffic, trafficBytes, DOWN_CAPACITY, UP_CAPACITY, type Task, type PreparedTraffic, };
