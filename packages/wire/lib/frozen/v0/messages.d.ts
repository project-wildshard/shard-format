import { type NetRoomAct } from './acts.ts';
import { type BitWriter } from './bits.ts';
import type { NetIdentity } from './types.ts';
import { type NetChat } from './chatWire.ts';
import { type NetLedger } from './ledgerWire.ts';
import type { QuestProgress } from './types.ts';
import type { DeathCause } from './types.ts';
export declare const MSG_HELLO = 1;
export declare const MSG_CMDS = 2;
export declare const MSG_ACT = 3;
export declare const MSG_WELCOME = 4;
export declare const MSG_FRAME = 5;
export declare const MSG_EVENTS = 6;
/** The id byte of any message, or 0 for an empty one. */
export declare function messageId(bytes: Uint8Array): number;
/**
 * `hello`: what the client was built from, a mismatch of either refused (J54), and who it is (J111). `ledger` is the last
 * receipt serial it has, so a client that comes back hears only what it missed (M8).
 */
export interface NetHello extends NetIdentity {
    readonly schemaHash: number;
    readonly build: string;
    readonly ledger: number;
}
export declare function encodeHello(writer: BitWriter, hello: NetHello): ArrayBuffer;
export declare function decodeHello(bytes: Uint8Array): NetHello | null;
/** `welcome`: your player's handle and id, the server's tick and rates (sim 60, frame 30, J40). A frame's rows leave its own player out, so nothing else names it. */
export interface NetWelcome {
    readonly handle: number;
    readonly player: string;
    readonly tick: number;
    readonly cell: number;
    readonly schemaHash: number;
    readonly simHz: number;
    readonly frameHz: number;
}
export declare function encodeWelcome(writer: BitWriter, welcome: NetWelcome): ArrayBuffer;
export declare function decodeWelcome(bytes: Uint8Array): NetWelcome | null;
/** An entity entering a client's relevance: its identity and initial fields, once (§3.4). */
export interface NetSpawn {
    readonly kind: 'spawn';
    readonly handle: number;
    readonly cls: number;
    readonly id: string;
    readonly initial: readonly number[];
    readonly text: readonly string[];
}
/** The server retired an entity, so its handle's slot may be reused under a new generation. */
export interface NetDespawn {
    readonly kind: 'despawn';
    readonly handle: number;
}
/** A cell-local vector. */
export type NetVector = readonly [number, number, number];
/** The server settled a hit (J47): impact FX, hit-stop and damage numbers play from this. `confirmFor` is the seq of the command that swung or fired this very blow, or 0. */
export interface NetHit {
    readonly kind: 'hit';
    readonly tick: number;
    readonly target: number;
    readonly amount: number;
    readonly at: NetVector;
    readonly head: boolean;
    readonly killed: boolean;
    readonly confirmFor: number;
    readonly blow?: boolean;
}
/** An entity died (J33): `by` is the killer's handle or 0; each client throws its own ragdoll along `dir` from `impulse`. */
export interface NetDied {
    readonly kind: 'died';
    readonly tick: number;
    readonly id: number;
    readonly by: number;
    readonly dir: NetVector;
    readonly impulse: number;
}
/** The owner's settled health lifecycle, after its checkpoint answered; creature ragdolls use `died` separately. */
export interface NetPlayerDied {
    readonly kind: 'player-died';
    readonly tick: number;
    readonly id: number;
    readonly checkpoint: boolean;
    readonly cause?: DeathCause;
}
/** J105: this client's own roll on a body paid out. Goes to its owner and nobody else. */
export interface NetReward {
    readonly kind: 'reward';
    readonly tick: number;
    readonly coins: number;
    readonly body: number;
    readonly item?: string;
}
/** A fight told its views something: a tell, a ring, a glow. A client's room draws them in order, and nothing here decides. */
export interface NetView {
    readonly kind: 'view';
    readonly tick: number;
    readonly name: string;
    readonly args: readonly number[];
}
/** The events a settled fight sends. */
export type NetCombatEvent = NetHit | NetDied | NetReward;
/** A quest moved for this client's own player (P1-E3.3), or it joined: quest state is per player and goes only to its owner. */
export interface NetQuest extends QuestProgress {
    readonly kind: 'quest';
    readonly tick: number;
}
/** One reliable event. E3 and E4 add `ledger` and the rest as their views need them. */
/** A flag that shapes this client's own world rose or fell (J106): its gates and keys are its alone. */
export interface NetPhase {
    readonly kind: 'phase';
    readonly tick: number;
    readonly flag: string;
    readonly on: boolean;
}
/** This client's player crossed (P1-E3.9): every id, handle and row it holds belongs to the cell it left, and a `welcome` for `to` follows. Cells are frames: 0 is the highway. */
export interface NetTravel {
    readonly kind: 'travel';
    readonly tick: number;
    readonly from: number;
    readonly to: number;
}
/** A player got on or off a ride (J48, §4.3). The ride itself is not predicted: a client's rider waits for this. `seq` is the command it stood at, 0 for anyone else's. */
interface NetRideChange<Kind extends string> {
    readonly kind: Kind;
    readonly tick: number;
    readonly rider: number;
    readonly mount: number;
    readonly seq: number;
}
export type NetRide = NetRideChange<'mount'> | NetRideChange<'dismount'>;
/** One line of what this client's own player holds in this world, a purse's coins or a pack's count, as it changed. 0 is gone. */
export interface NetOwned {
    readonly kind: 'owned';
    readonly tick: number;
    readonly name: string;
    readonly value: number;
}
export type NetEvent = NetSpawn | NetDespawn | NetCombatEvent | NetPlayerDied | NetView | NetQuest | NetPhase | NetTravel | NetLedger | NetChat | NetRide | NetOwned;
/** The events' and commands' wire form, in NET_SCHEMA_HASH: a change here must refuse a stale client like a field table's does (J54). */
export declare const NET_EVENT_FORMS = "view:s,u8,f32n;hit:h16,f32,p48,b,b,b,u16;died:h16,h16,d24,f32;player-died:h16,b,b,?s,?s,b,?s;quest:s,b,b,s,u16;phase:s,b;reward:u32,h16,b,?s;travel:u16,u16;ledger:u32,u32,s,u2,s,f32,b;chat:u32,u32,b,h16,s,s;buttons:u8,b,u8;lockTarget:h16;hookTarget:u16;ride:u8;fresh:b;mount:h16,h16,u16;dismount:h16,h16,u16;rideWords:b,u8,f32;climate:b,s,f32;buy:u16;board:b,u16;wear:s;pose:s;owned:s,f32";
/** The spawn's column widths, which only the receiver's class table knows. */
export type InitialBits = (cls: number) => {
    readonly bits: readonly number[];
    readonly text: number;
} | undefined;
/** Encode an `events` message; `bits` gives the spawn fields' declared widths. */
export declare function encodeEvents(writer: BitWriter, tick: number, events: readonly NetEvent[], bits: InitialBits): ArrayBuffer;
/** Decode an `events` message. An unknown class or event kind refuses the whole message. */
export declare function decodeEvents(bytes: Uint8Array, bits: InitialBits): {
    readonly tick: number;
    readonly events: readonly NetEvent[];
} | null;
/** Encode an `act` message. */
export declare function encodeAct(writer: BitWriter, act: NetRoomAct): ArrayBuffer;
/** Decode an `act` message. */
export declare function decodeAct(bytes: Uint8Array): NetRoomAct | null;
export {};
