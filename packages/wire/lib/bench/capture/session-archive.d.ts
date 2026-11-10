import { ENGINE } from './session-data.ts';
import type { CapturedSession } from './session-data.ts';
declare const kinds: readonly ['words', 'frames', 'packets'];
type PartKind = (typeof kinds)[number];
interface SessionPart {
    readonly file: string;
    readonly kind: PartKind;
    readonly start: number;
    readonly count: number;
    readonly bytes: number;
    readonly hash: string;
}
interface SessionManifest {
    readonly format: 'wire-capture-json/1';
    readonly engine: typeof ENGINE;
    readonly product: string;
    readonly ticks: number;
    readonly bytes: number;
    readonly hash: string;
    readonly parts: readonly SessionPart[];
}
interface SessionArchive {
    readonly manifest: SessionManifest;
    readonly files: ReadonlyMap<string, Readonly<Uint8Array>>;
}
/** Lossless whole arrays keep every repository file below 1 MB without a bypass. */
declare function archiveSession(value: unknown): Promise<SessionArchive>;
/** Verify complete storage and mandatory frozen replay before returning any recording. */
declare function readSessionArchive(value: unknown, read: (file: string) => Promise<Readonly<Uint8Array>>): Promise<CapturedSession>;
export { archiveSession, readSessionArchive, type SessionArchive, type SessionManifest, };
