import type { BitReader, BitWriter } from './bits.ts';
import type { ChatChannel } from './acts.ts';
/** One line a client hears. `line` is what a report names; `from` is the speaker's handle, or 0 when out of the client's sight. */
export interface NetChat {
    readonly kind: 'chat';
    readonly tick: number;
    readonly line: number;
    readonly channel: ChatChannel;
    readonly from: number;
    readonly name: string;
    readonly text: string;
}
/** Write a line after its event id. */
export declare function writeChat(writer: BitWriter, event: NetChat): void;
/** Read a line after its event id. */
export declare function readChat(reader: BitReader): NetChat;
