import type { NetCommand } from './netCommand.ts';
import { BitReader, type BitWriter } from './bits.ts';
import type { NetRefs } from './schema.ts';
/** Buttons that fire once on their `seq`, LOCK's toggle among them; the rest are holds, and only holds last through an empty tick. */
export declare const NET_PRESSES: number;
/** The most commands one bundle may carry: MAX_FIXED_STEPS new ones plus 4 redundant copies. */
export declare const MAX_BUNDLE = 7;
/** Maps a net handle back to its stable id; undefined for a handle the room does not know. */
export type NetIds = (handle: number) => string | undefined;
/** True when wrapping `seq` is newer than `than`. */
export declare function seqAfter(seq: number, than: number): boolean;
/** The steer, yaw and pitch the server will decode from `command`, so a client steps what it sends (P1-E5.3-C4). The yaw keeps
 *  its turns: the server's is the same angle, and the view must not jump a turn. */
export declare function quantiseCommand<C extends Pick<NetCommand, 'steer' | 'yaw' | 'pitch'>>(command: C): C;
/** Write one command. A target the receiver has no handle for goes as none. */
export declare function writeCommand(writer: BitWriter, command: NetCommand, refs: NetRefs): void;
/** Read one command. Its bounds are not checked here: admission (`NetCommandSchema`) does that on the decoded value. */
export declare function readCommand(reader: BitReader, ids: NetIds): NetCommand;
/** The `cmds` message: the newest frame the client holds, then its bundle. */
export interface CommandBundle {
    readonly ackFrame: number;
    readonly commands: readonly NetCommand[];
}
/** Encode a `cmds` message. */
export declare function encodeCommands(writer: BitWriter, bundle: CommandBundle, refs: NetRefs): ArrayBuffer;
/** Decode a `cmds` message, or null when it is malformed or floods its cap. */
export declare function decodeCommands(bytes: Uint8Array, ids: NetIds): CommandBundle | null;
