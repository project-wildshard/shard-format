/** Cell-local metres over ±260 m in 16 bits, an 8 mm step. */
declare const METRES: {
    readonly kind: 'quant';
    readonly min: -260;
    readonly max: 260;
    readonly bits: 16;
};
/** A unit fraction in 6 bits. */
declare const UNIT_6: {
    readonly kind: 'quant';
    readonly min: 0;
    readonly max: 1;
    readonly bits: 6;
};
/** A unit fraction in 8 bits. */
declare const UNIT_8: {
    readonly kind: 'quant';
    readonly min: 0;
    readonly max: 1;
    readonly bits: 8;
};
/** A unit fraction in 10 bits. */
declare const UNIT_10: {
    readonly kind: 'quant';
    readonly min: 0;
    readonly max: 1;
    readonly bits: 10;
};
/** A unit axis component in 8 bits. */
declare const SIGNED_UNIT_8: {
    readonly kind: 'quant';
    readonly min: -1;
    readonly max: 1;
    readonly bits: 8;
};
declare const BOOL: {
    readonly kind: 'bool';
};
declare const F32: {
    readonly kind: 'f32';
};
declare const F64: {
    readonly kind: 'f64';
};
declare const U5: {
    readonly kind: 'uint';
    readonly bits: 5;
};
declare const U8: {
    readonly kind: 'uint';
    readonly bits: 8;
};
declare const U16: {
    readonly kind: 'uint';
    readonly bits: 16;
};
declare const U32: {
    readonly kind: 'uint';
    readonly bits: 32;
};
declare const REF: {
    readonly kind: 'ref';
};
/** Net text: at most 255 UTF-8 bytes (`MAX_NET_TEXT_BYTES`). */
declare const TEXT: {
    readonly kind: 'text';
    readonly maxBytes: 255;
};
declare const ANGLE_10: {
    readonly kind: 'angle';
    readonly bits: 10;
};
declare const ANGLE_16: {
    readonly kind: 'angle';
    readonly bits: 16;
};
/** One steer axis: `round(v * 127) + 128` (`packAxis`). */
declare const AXIS: {
    readonly kind: 'fixed';
    readonly bits: 8;
    readonly divisor: 127;
    readonly offset: -128;
};
declare const PITCH: {
    readonly kind: 'quant';
    readonly min: number;
    readonly max: number;
    readonly bits: 16;
};
/** A record's tick: the first field of every timed event and frame. */
declare const TICK: {
    readonly id: 1;
    readonly name: 'tick';
    readonly node: {
        readonly kind: 'uint';
        readonly bits: 32;
    };
};
declare const OPTIONAL_TEXT: {
    readonly kind: 'optional';
    readonly node: {
        readonly kind: 'text';
        readonly maxBytes: 255;
    };
};
/** Where a line of chat goes (J110). */
declare const CHAT_CHANNELS: readonly ['room', 'proximity'];
declare const CHANNEL: {
    readonly kind: 'enum';
    readonly values: readonly ["room", "proximity"];
    readonly default: 'room';
};
export { CHANNEL, CHAT_CHANNELS, OPTIONAL_TEXT, TICK, ANGLE_10, ANGLE_16, AXIS, BOOL, F32, F64, METRES, PITCH, REF, SIGNED_UNIT_8, TEXT, U16, U32, U5, U8, UNIT_10, UNIT_6, UNIT_8, };
