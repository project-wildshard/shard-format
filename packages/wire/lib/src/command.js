import { STEER_AXIS_CODEC } from './fixed.js';
const FULL_TURN = 2;
const HALF = 0.5;
const TAU = Math.PI * FULL_TURN;
const YAW_STEPS = 65_536;
const PITCH_TOP = 65_535;
function axis(value) {
    return STEER_AXIS_CODEC.decode(STEER_AXIS_CODEC.encode(value));
}
/** The wire-owned command quantization; frozen v0 stays independent. */
function quantiseCommand(command) {
    const { steer } = command;
    return {
        ...command,
        steer: {
            keyX: axis(steer.keyX),
            keyY: axis(steer.keyY),
            stickX: axis(steer.stickX),
            stickY: axis(steer.stickY),
        },
        yaw: (Math.round((command.yaw / TAU) * YAW_STEPS) / YAW_STEPS) * TAU,
        pitch: (Math.round((command.pitch / Math.PI + HALF) * PITCH_TOP) / PITCH_TOP -
            HALF) *
            Math.PI,
    };
}
export { quantiseCommand };
