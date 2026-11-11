import type { WireEvent } from '../../src/game.ts';
import type { WireStruct } from '../../src/values.ts';
/** One v0 command as the v1 command struct. */
declare function v1Command(command: {
    readonly buttons: number;
    readonly attack?: {
        readonly targetId?: string;
        readonly aim: object;
    };
    readonly heavyTarget?: string;
    readonly lockTarget?: string;
    readonly launcher?: {
        readonly fire?: true;
    };
} & object): WireStruct;
/** One v0 act as the v1 act union's arm. */
declare function v1Act(act: {
    readonly kind: string;
    readonly seq: number;
} & object): WireStruct;
/** One v0 event as a v1 event. */
declare function v1Event(event: {
    readonly kind: string;
} & object): WireEvent;
export { v1Act, v1Command, v1Event };
