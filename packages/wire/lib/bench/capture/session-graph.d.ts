import { ENGINE } from './session-data.ts';
import type { CapturedSession } from './session-data.ts';
interface Part {
    readonly file: string;
    readonly start: number;
    readonly count: number;
    readonly bytes: number;
    readonly expandedBytes: number;
    readonly hash: string;
}
interface Header {
    readonly format: 'wire-capture-graph/1';
    readonly engine: typeof ENGINE;
    readonly product: string;
    readonly ticks: number;
    readonly root: number;
    readonly nodes: number;
    readonly expandedBytes: number;
    readonly hash: string;
    readonly parts: readonly Part[];
}
interface GraphArchive {
    readonly manifest: Header;
    readonly files: ReadonlyMap<string, Readonly<Uint8Array>>;
}
/** Lossless structural sharing for dense captures; the frozen codec remains unchanged. */
declare function archiveGraphSession(value: unknown): Promise<GraphArchive>;
/** Hash, reconstruct and frozen-replay all content before returning a dense session. */
declare function readGraphSession(value: unknown, read: (file: string) => Promise<Readonly<Uint8Array>>): Promise<CapturedSession>;
export { archiveGraphSession, readGraphSession, type GraphArchive };
