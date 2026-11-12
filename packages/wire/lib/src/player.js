import { ANGLE_10, BOOL, F32, F64, METRES, TEXT, U16, U8 } from './nodes.js';
// The `player` class: a row for everyone else, an exact owner block for its
// owner (J140). Ids 1 to 53 are the WS2 baseline's order at engine cfd6681;
// `name` (54) was added after it, and `swing`, `heavy` and `air` (55 to 57)
// after that (REMOTE-PLAYERS RP6). Declared order is the sender's layout.
const PREDICTED = { send: 'all', predicted: true };
const OWNER = { send: 'owner' };
const OTHERS = { send: 'others', required: true };
/** The `player` class. */
const PLAYER = {
    id: 1,
    name: 'player',
    fields: [
        { id: 1, name: 'x', node: METRES, ...OTHERS },
        { id: 2, name: 'y', node: METRES, ...OTHERS },
        { id: 3, name: 'z', node: METRES, ...OTHERS },
        { id: 4, name: 'yaw', node: ANGLE_10, send: 'others' },
        { id: 54, name: 'name', node: TEXT, send: 'initial' },
        { id: 5, name: 'board', node: BOOL },
        { id: 6, name: 'swim', node: BOOL },
        { id: 7, name: 'hp', node: U16 },
        { id: 8, name: 'maxHp', node: U16, ...OWNER },
        { id: 9, name: 'statusStun', node: F32, ...OWNER },
        { id: 10, name: 'held', node: U8 },
        // What another page animates (RP6): a count that moves on each swing or
        // shot and wraps at 256, whether that swing was the heavy, and whether
        // the body is off the ground (not swimming). The owner has its own.
        { id: 55, name: 'swing', node: U8, send: 'others' },
        { id: 56, name: 'heavy', node: BOOL, send: 'others' },
        { id: 57, name: 'air', node: BOOL, send: 'others' },
        { id: 11, name: 'px', node: F64, ...PREDICTED },
        { id: 12, name: 'py', node: F64, ...PREDICTED },
        { id: 13, name: 'pz', node: F64, ...PREDICTED },
        { id: 14, name: 'vx', node: F64, ...PREDICTED },
        { id: 15, name: 'vy', node: F64, ...PREDICTED },
        { id: 16, name: 'vz', node: F64, ...PREDICTED },
        { id: 17, name: 'grounded', node: BOOL, ...PREDICTED },
        { id: 18, name: 'dashT', node: F32, ...PREDICTED },
        { id: 19, name: 'dodgeT', node: F32, ...PREDICTED },
        { id: 20, name: 'dodgeCd', node: F32, ...PREDICTED },
        { id: 21, name: 'shoveT', node: F32, ...PREDICTED },
        { id: 22, name: 'shoveX', node: F32, ...PREDICTED },
        { id: 23, name: 'shoveZ', node: F32, ...PREDICTED },
        { id: 24, name: 'dashX', node: F32, ...PREDICTED },
        { id: 25, name: 'dashZ', node: F32, ...PREDICTED },
        { id: 26, name: 'impulseX', node: F32, ...PREDICTED },
        { id: 27, name: 'impulseY', node: F32, ...PREDICTED },
        { id: 28, name: 'impulseZ', node: F32, ...PREDICTED },
        { id: 29, name: 'lockR0', node: F32, ...PREDICTED },
        { id: 30, name: 'jumpAgo', node: F32, ...PREDICTED },
        { id: 31, name: 'jumpLeft', node: F32, ...PREDICTED },
        { id: 32, name: 'hoverAir', node: BOOL, ...PREDICTED },
        { id: 33, name: 'hoverBob', node: F32, ...PREDICTED },
        { id: 34, name: 'stood', node: BOOL, ...PREDICTED },
        { id: 35, name: 'diving', node: BOOL, ...PREDICTED },
        { id: 36, name: 'climbTo', node: F32, ...PREDICTED },
        { id: 37, name: 'climbCooldown', node: F32, ...PREDICTED },
        { id: 38, name: 'strokeTime', node: F32, ...PREDICTED },
        { id: 39, name: 'water', node: F32, ...PREDICTED },
        { id: 40, name: 'depth', node: F32, ...PREDICTED },
        { id: 41, name: 'wading', node: BOOL, ...PREDICTED },
        { id: 42, name: 'onPlatform', node: BOOL, ...PREDICTED },
        { id: 43, name: 'sliding', node: BOOL, ...PREDICTED },
        { id: 44, name: 'motorGrounded', node: BOOL, ...PREDICTED },
        { id: 45, name: 'groundNormalY', node: F32, ...PREDICTED },
        { id: 46, name: 'downhillX', node: F32, ...PREDICTED },
        { id: 47, name: 'downhillZ', node: F32, ...PREDICTED },
        { id: 48, name: 'freedom', node: F32, ...PREDICTED },
        { id: 49, name: 'swingPhase', node: F32, ...OWNER },
        { id: 50, name: 'lastSwingSeq', node: U16, ...OWNER },
        { id: 51, name: 'moveScale', node: F32, ...OWNER },
        { id: 52, name: 'resets', node: U16, ...OWNER },
        { id: 53, name: 'led', node: BOOL, ...OWNER },
    ],
};
export { PLAYER };
