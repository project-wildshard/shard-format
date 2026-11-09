import * as v from 'valibot';
import { NetActSchema } from './netCommand.js';
// P1-E5.2c (§4.2): the acts the engine adds to the format's own. Chat is the engine's concern, so it never reaches the shard format.
/** Where a line of chat goes (J110): everyone in the room, which is J110's shard channel, or who stands near. No global channel. */
export const CHAT_CHANNELS = ['room', 'proximity'];
/** A lone player's word on the sky: their weather setting, or a dev's phase jump. A room shares its sky, so with others in it this does nothing. `at` is a phase's fraction, -1 for the mode's own. */
/** How an `interact` names a story flag on a shard whose page runs its story. */
export const STORY_ACT = 'story:';
/** What a word on the sky says: its mode, a jump to a phase, a Developer's time of day, or where a page's day stood as a player came back from a room the world waited out. */
export const CLIMATE_OPS = ['mode', 'force', 'time', 'day'];
/** The longest name a climate act may give. */
const CLIMATE_NAME = 64;
/** The longest list one pose act may give, net text's own cap: a page with more sends more than one. */
export const POSE_NAMES = 255;
const u16 = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffff));
/** A decoded act fit for the room. */
export const NetRoomActSchema = v.union([NetActSchema,
    v.strictObject({ kind: v.literal('buy'), seq: u16, good: u16 }),
    v.strictObject({ kind: v.literal('pose'), seq: u16, names: v.pipe(v.string(), v.minLength(1), v.maxLength(POSE_NAMES)) }),
    v.strictObject({ kind: v.literal('wear'), seq: u16, id: v.pipe(v.string(), v.minLength(1), v.maxLength(CLIMATE_NAME)) }),
    v.strictObject({ kind: v.literal('board'), seq: u16, op: v.picklist(['claim', 'tear']), slot: u16 }),
    v.strictObject({ kind: v.literal('climate'), seq: u16, op: v.picklist(CLIMATE_OPS), name: v.pipe(v.string(), v.minLength(1), v.maxLength(CLIMATE_NAME)), at: v.pipe(v.number(), v.finite(), v.minValue(-1), v.maxValue(1)) }),
    v.strictObject({ kind: v.literal('chat'), seq: u16, channel: v.picklist(CHAT_CHANNELS), text: v.pipe(v.string(), v.minLength(1), v.maxLength(255)) }),
    v.strictObject({ kind: v.literal('report'), seq: u16, line: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffffff)) }),
]);
