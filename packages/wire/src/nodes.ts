// Shared grammar nodes. Each is plain data; descriptors spread or name them.

/** Cell-local metres over ±260 m in 16 bits, an 8 mm step. */
const METRES = { kind: 'quant', min: -260, max: 260, bits: 16 } as const
/** A unit fraction in 6 bits. */
const UNIT_6 = { kind: 'quant', min: 0, max: 1, bits: 6 } as const
/** A unit fraction in 8 bits. */
const UNIT_8 = { kind: 'quant', min: 0, max: 1, bits: 8 } as const
/** A unit fraction in 10 bits. */
const UNIT_10 = { kind: 'quant', min: 0, max: 1, bits: 10 } as const
/** A unit axis component in 8 bits. */
const SIGNED_UNIT_8 = { kind: 'quant', min: -1, max: 1, bits: 8 } as const
const BOOL = { kind: 'bool' } as const
const F32 = { kind: 'f32' } as const
const F64 = { kind: 'f64' } as const
const U5 = { kind: 'uint', bits: 5 } as const
const U8 = { kind: 'uint', bits: 8 } as const
const U16 = { kind: 'uint', bits: 16 } as const
const U32 = { kind: 'uint', bits: 32 } as const
const REF = { kind: 'ref' } as const
/** Net text: at most 255 UTF-8 bytes (`MAX_NET_TEXT_BYTES`). */
const TEXT = { kind: 'text', maxBytes: 255 } as const
const ANGLE_10 = { kind: 'angle', bits: 10 } as const
const ANGLE_16 = { kind: 'angle', bits: 16 } as const
/** One steer axis: `round(v * 127) + 128` (`packAxis`). */
const AXIS = { kind: 'fixed', bits: 8, divisor: 127, offset: -128 } as const
/** Pitch over ±π/2 in 16 bits. */
const HALVES = 2
const RIGHT_ANGLE = Math.PI / HALVES
const PITCH = {
  kind: 'quant',
  min: -RIGHT_ANGLE,
  max: RIGHT_ANGLE,
  bits: 16,
} as const

/** A record's tick: the first field of every timed event and frame. */
const TICK = { id: 1, name: 'tick', node: U32 } as const
const OPTIONAL_TEXT = { kind: 'optional', node: TEXT } as const
/** Where a line of chat goes (J110). */
const CHAT_CHANNELS = ['room', 'proximity'] as const
const CHANNEL = {
  kind: 'enum',
  values: CHAT_CHANNELS,
  default: 'room',
} as const

export {
  CHANNEL,
  CHAT_CHANNELS,
  OPTIONAL_TEXT,
  TICK,
  ANGLE_10,
  ANGLE_16,
  AXIS,
  BOOL,
  F32,
  F64,
  METRES,
  PITCH,
  REF,
  SIGNED_UNIT_8,
  TEXT,
  U16,
  U32,
  U5,
  U8,
  UNIT_10,
  UNIT_6,
  UNIT_8,
}
