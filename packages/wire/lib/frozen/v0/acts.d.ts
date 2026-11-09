import * as v from 'valibot';
import { type NetAct } from './netCommand.ts';
/** Where a line of chat goes (J110): everyone in the room, which is J110's shard channel, or who stands near. No global channel. */
export declare const CHAT_CHANNELS: readonly ['room', 'proximity'];
export type ChatChannel = (typeof CHAT_CHANNELS)[number];
/** Say something. Plain text, cleaned and filtered on the server. */
export interface NetChatSay {
    readonly kind: 'chat';
    readonly seq: number;
    readonly channel: ChatChannel;
    readonly text: string;
}
/** Report a line of chat by its id. */
export interface NetChatReport {
    readonly kind: 'report';
    readonly seq: number;
    readonly line: number;
}
/** A lone player's word on the sky: their weather setting, or a dev's phase jump. A room shares its sky, so with others in it this does nothing. `at` is a phase's fraction, -1 for the mode's own. */
/** How an `interact` names a story flag on a shard whose page runs its story. */
export declare const STORY_ACT = "story:";
export interface NetClimateAct {
    readonly kind: 'climate';
    readonly seq: number;
    readonly op: typeof CLIMATE_OPS[number];
    readonly name: string;
    readonly at: number;
}
/** Buy one of the shard's goods, by its place in the shard's exchange. The server checks it and takes the price. */
export interface NetBuyAct {
    readonly kind: 'buy';
    readonly seq: number;
    readonly good: number;
}
/** Claim a filled contract or tear one off the board, by its slot. */
export interface NetBoardAct {
    readonly kind: 'board';
    readonly seq: number;
    readonly op: 'claim' | 'tear';
    readonly slot: number;
}
/** Put on or take off a cosmetic this player owns. */
export interface NetWearAct {
    readonly kind: 'wear';
    readonly seq: number;
    readonly id: string;
}
/** The `mem` inputs this page's pose programs read, comma separated: a server pack holds no programme, so it can't tell them from a brain's memory. */
export interface NetPoseAct {
    readonly kind: 'pose';
    readonly seq: number;
    readonly names: string;
}
/** An act the sim takes on its tick. */
export type NetTickAct = NetAct | NetClimateAct | NetBuyAct | NetBoardAct | NetWearAct | NetPoseAct;
/** Any act a client may send. */
export type NetRoomAct = NetTickAct | NetChatSay | NetChatReport;
/** What a word on the sky says: its mode, a jump to a phase, a Developer's time of day, or where a page's day stood as a player came back from a room the world waited out. */
export declare const CLIMATE_OPS: readonly ['mode', 'force', 'time', 'day'];
/** The longest list one pose act may give, net text's own cap: a page with more sends more than one. */
export declare const POSE_NAMES = 255;
/** A decoded act fit for the room. */
export declare const NetRoomActSchema: v.GenericSchema<NetRoomAct>;
