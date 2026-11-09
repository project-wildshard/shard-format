import * as v from 'valibot';
// P1-E5.2 (E5-REPLICATION §4.2): the admission grammar of decoded input. Bytes from a client are decoded first, then
// every command and act passes through these schemas before the room queues it (MMO-REQUIREMENTS R3). The aim carries
// world coordinates, as AimCommand does; the bounds keep a hostile value out of the fixed tick.
const finite = v.pipe(v.number(), v.finite());
const u16 = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffff));
const axis = v.pipe(finite, v.minValue(-1), v.maxValue(1));
const point = v.strictObject({ x: finite, y: finite, z: finite });
const id = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9._:-]{1,128}$/u));
const slot = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(31));
/** The riding acts: hold out an offer to a wild mount, climb on, climb off. */
const RIDE_ACTIONS = ['offer', 'mount', 'dismount'];
/** A decoded command fit for the fixed tick. */
export const NetCommandSchema = v.strictObject({
    seq: u16, viewTick: u16,
    steer: v.strictObject({ keyX: axis, keyY: axis, stickX: axis, stickY: axis }),
    yaw: finite, pitch: v.pipe(finite, v.minValue(-Math.PI / 2 - 1e-3), v.maxValue(Math.PI / 2 + 1e-3)),
    buttons: u16,
    attack: v.exactOptional(v.strictObject({ targetId: v.exactOptional(id), aim: v.strictObject({ origin: point, direction: point }) })),
    heavyTarget: v.exactOptional(id),
    lockTarget: v.exactOptional(id),
    hookTarget: v.exactOptional(u16),
    launcher: v.exactOptional(v.strictObject({ slot,
        ads: v.pipe(finite, v.minValue(0), v.maxValue(1)), fire: v.exactOptional(v.literal(true)) })),
});
/** A decoded act fit for the fixed tick. */
export const NetActSchema = v.variant('kind', [
    v.strictObject({ kind: v.literal('interact'), seq: u16, id }),
    v.strictObject({ kind: v.literal('reload'), seq: u16, slot }),
    v.strictObject({ kind: v.literal('equip'), seq: u16, slot }),
    v.strictObject({ kind: v.literal('ride'), seq: u16, action: v.picklist(RIDE_ACTIONS) }),
]);
