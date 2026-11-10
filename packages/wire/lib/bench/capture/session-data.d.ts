import type { CapturedFrame } from './frame-data.ts';
declare const VERSION = 1;
declare const ENGINE = "cfd668102efcb7c10a6fb57d3021c1f3d23c37a5";
interface PacketFields {
    readonly tick: number;
    readonly direction: 'up' | 'down';
    readonly channel: 'reliable' | 'unreliable';
    readonly delivered: boolean;
}
type CapturedPacket = PacketFields & ({
    readonly frame: number;
} | {
    readonly packet: {
        readonly bytes: string;
    };
});
interface StoredSession {
    readonly version: typeof VERSION;
    readonly engine: typeof ENGINE;
    readonly product: string;
    readonly ticks: number;
    readonly frames: {
        readonly version: typeof VERSION;
        readonly wordTable: readonly string[];
        readonly frames: readonly unknown[];
    };
    readonly packets: readonly CapturedPacket[];
}
interface CapturedSession {
    readonly version: typeof VERSION;
    readonly engine: typeof ENGINE;
    readonly product: string;
    readonly ticks: number;
    readonly frames: readonly CapturedFrame[];
    readonly packets: readonly CapturedPacket[];
}
/** Validate every actual stream and per-handle callback before timing or storage. */
declare function parseStoredSession(value: unknown): StoredSession;
/** Expanded values remain opaque, bit-exact snapshots from frozen-v0 replay. */
declare function parseSession(value: unknown): CapturedSession;
export { VERSION, ENGINE, parseStoredSession, parseSession, type StoredSession, type CapturedSession, };
