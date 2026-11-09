import * as v from 'valibot';
/** The riding acts: hold out an offer to a wild mount, climb on, climb off. */
declare const RIDE_ACTIONS: readonly ['offer', 'mount', 'dismount'];
/** Raw local axes, as LocalSteer holds them. */
export interface NetSteer {
    readonly keyX: number;
    readonly keyY: number;
    readonly stickX: number;
    readonly stickY: number;
}
/** World-space aim, as AimCommand holds it. */
export interface NetAim {
    readonly origin: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
    };
    readonly direction: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
    };
}
/** One client sim step of input (§4.2). */
export interface NetCommand {
    /** Wrapping, one per client sim step. */
    readonly seq: number;
    /** The low 16 bits of the server tick the client was rendering others at, for the rewind in E5.3. */
    readonly viewTick: number;
    readonly steer: NetSteer;
    readonly yaw: number;
    readonly pitch: number;
    /** NET_BUTTONS bits, 16 of them: the presses jump, dodge, hover, lock; the holds sprint, crouch, dive, surface, heavy. */
    readonly buttons: number;
    /** A swing or shot start (J41); `targetId` keeps today's lock-on. */
    readonly attack?: {
        readonly targetId?: string;
        readonly aim: NetAim;
    };
    /** What the heavy hold is aimed at while the crosshair is on something. */
    readonly heavyTarget?: string;
    /** J116: the target this client's lock-on orbits. Both sides compute the same orbit from it; the server checks it is real and in range. */
    readonly lockTarget?: string;
    /** The hook a LOCK press picks: its index in the course's `hooks`, which have no id or handle. The server checks it is real, in range and in sight. */
    readonly hookTarget?: number;
    readonly launcher?: {
        readonly slot: number;
        readonly ads: number;
        readonly fire?: true;
    };
}
/** A non-movement action that must not be lost (§4.2), carrying the `seq` it belongs to. */
export type NetAct = {
    readonly kind: 'interact';
    readonly seq: number;
    readonly id: string;
} | {
    readonly kind: 'reload';
    readonly seq: number;
    readonly slot: number;
} | {
    readonly kind: 'equip';
    readonly seq: number;
    readonly slot: number;
} | {
    readonly kind: 'ride';
    readonly seq: number;
    readonly action: (typeof RIDE_ACTIONS)[number];
};
/** A decoded command fit for the fixed tick. */
export declare const NetCommandSchema: v.GenericSchema<NetCommand>;
/** A decoded act fit for the fixed tick. */
export declare const NetActSchema: v.GenericSchema<NetAct>;
export {};
