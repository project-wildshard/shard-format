import { exactOptional, finite, integer, literal, maxValue, minValue, number, picklist, pipe, regex, strictObject, string, variant, } from 'valibot';
// P1-E5.2 (E5-REPLICATION §4.2): the admission grammar of decoded input. Bytes
// from a client are decoded first, then every command and act passes through
// these schemas before the room queues it (MMO-REQUIREMENTS R3). The aim
// carries world coordinates, as AimCommand does; the bounds keep a hostile
// value out of the fixed tick. Moved here from `@wildshard/shard-format/netCommand`
// (WIRE-STABILITY WR2), which re-exports it unchanged.
const ZERO = 0;
const ONE = 1;
const HALVES = 2;
const U16_TOP = 65_535;
const SLOT_TOP = 31;
const ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/u;
/** Pitch may sit a hair past a right angle once quantized. */
const PITCH_SLACK = 1e-3;
const PITCH_LIMIT = Math.PI / HALVES + PITCH_SLACK;
const finiteNumber = pipe(number(), finite());
const u16 = pipe(finiteNumber, integer(), minValue(ZERO), maxValue(U16_TOP));
const axis = pipe(finiteNumber, minValue(-ONE), maxValue(ONE));
const unit = pipe(finiteNumber, minValue(ZERO), maxValue(ONE));
/* oxlint-disable id-length -- world axes are x, y and z on the wire */
const point = strictObject({
    x: finiteNumber,
    y: finiteNumber,
    z: finiteNumber,
});
/* oxlint-enable id-length */
const id = pipe(string(), regex(ID_PATTERN));
const slot = pipe(finiteNumber, integer(), minValue(ZERO), maxValue(SLOT_TOP));
const aim = strictObject({ origin: point, direction: point });
const attack = strictObject({ targetId: exactOptional(id), aim });
const launcher = strictObject({
    slot,
    ads: unit,
    fire: exactOptional(literal(true)),
});
/** The riding acts: hold out an offer to a wild mount, climb on, climb off. */
const RIDE_ACTIONS = ['offer', 'mount', 'dismount'];
/** A decoded command fit for the fixed tick. */
const NetCommandSchema = strictObject({
    seq: u16,
    viewTick: u16,
    steer: strictObject({ keyX: axis, keyY: axis, stickX: axis, stickY: axis }),
    yaw: finiteNumber,
    pitch: pipe(finiteNumber, minValue(-PITCH_LIMIT), maxValue(PITCH_LIMIT)),
    buttons: u16,
    attack: exactOptional(attack),
    heavyTarget: exactOptional(id),
    lockTarget: exactOptional(id),
    hookTarget: exactOptional(u16),
    launcher: exactOptional(launcher),
});
/** A decoded act fit for the fixed tick. */
const NetActSchema = variant('kind', [
    strictObject({ kind: literal('interact'), seq: u16, id }),
    strictObject({ kind: literal('reload'), seq: u16, slot }),
    strictObject({ kind: literal('equip'), seq: u16, slot }),
    strictObject({
        kind: literal('ride'),
        seq: u16,
        action: picklist(RIDE_ACTIONS),
    }),
]);
export { NetActSchema, NetCommandSchema, RIDE_ACTIONS, };
