import {
  ANGLE_10,
  ANGLE_16,
  BOOL,
  F32,
  METRES,
  REF,
  TEXT,
  U16,
  U32,
  U8,
  UNIT_10,
  UNIT_6,
  UNIT_8,
} from './nodes.ts'
import { PLAYER } from './player.ts'

import type { WireClass } from './grammar.ts'

// WIRE-STABILITY 5.2: class ids are stable, never an index. Field ids are the
// WS2 baseline's order + 1. Engine binds an accessor to every field (WR2).
const INITIAL = { send: 'initial' } as const
const AT = { required: true } as const

/** A creature's AI state, as a view poses it. */
const ANIMAL_STATES = [
  'idle',
  'graze',
  'wander',
  'alert',
  'flee',
  'charge',
  'stalk',
  'dead',
  'attack',
  'perch',
  'rise',
  'hide',
  'sidestep',
] as const
/** A boss or elite encounter's bar state. */
const ENCOUNTER_STATES = [
  'dormant',
  'armed',
  'intro',
  'fight',
  'beat',
  'victory',
  'absent',
  'idle',
  'aware',
  'engaged',
  'leash',
  'dead',
  'broken',
  'retired',
] as const

/** The `animal` class: look once in the spawn, the rest as delta rows. */
const ANIMAL = {
  id: 2,
  name: 'animal',
  relevance: 160,
  fields: [
    { id: 1, name: 'x', node: METRES, ...AT },
    { id: 2, name: 'y', node: METRES, ...AT },
    { id: 3, name: 'z', node: METRES, ...AT },
    { id: 4, name: 'yaw', node: ANGLE_10 },
    {
      id: 5,
      name: 'state',
      node: { kind: 'enum', values: ANIMAL_STATES, default: 'idle' },
    },
    { id: 6, name: 'attackT', node: UNIT_8 },
    { id: 7, name: 'attackDur', node: U32 },
    { id: 8, name: 'attackStamp', node: U32 },
    { id: 9, name: 'winding', node: BOOL },
    { id: 10, name: 'flinch', node: UNIT_6 },
    {
      id: 11,
      name: 'strafe',
      node: { kind: 'quant', min: -9, max: 9, bits: 8 },
    },
    { id: 12, name: 'brace', node: UNIT_6 },
    { id: 13, name: 'hp', node: U16 },
    { id: 14, name: 'alive', node: BOOL },
    { id: 15, name: 'target', node: REF },
    { id: 16, name: 'rideable', node: BOOL },
    { id: 17, name: 'rise', node: UNIT_6 },
    { id: 18, name: 'act', node: U8 },
    { id: 19, name: 'kind', node: TEXT, ...INITIAL },
    { id: 20, name: 'variant', node: TEXT, ...INITIAL },
    { id: 21, name: 'rarity', node: TEXT, ...INITIAL },
    { id: 22, name: 'scale', node: F32, ...INITIAL },
    { id: 23, name: 'seed', node: U32, ...INITIAL },
    // A declared shard's species id: two species may share one native `kind` (TE-ENG7). Empty for a native body.
    { id: 24, name: 'species', node: TEXT, ...INITIAL },
  ],
} as const satisfies WireClass

/** The `encounter` class: a boss or elite bar, anywhere in the cell. */
const ENCOUNTER = {
  id: 3,
  name: 'encounter',
  fields: [
    {
      id: 1,
      name: 'state',
      node: { kind: 'enum', values: ENCOUNTER_STATES, default: 'dormant' },
    },
    { id: 2, name: 'hp', node: UNIT_10 },
    { id: 3, name: 'phase', node: U8 },
    { id: 4, name: 'shield', node: BOOL },
    { id: 5, name: 'body', node: REF },
    { id: 6, name: 'skip', node: UNIT_6 },
    { id: 7, name: 'banners', node: U8 },
    { id: 8, name: 'signatures', node: U8 },
    { id: 9, name: 'known', node: BOOL },
    { id: 10, name: 'sleep', node: UNIT_8 },
    { id: 11, name: 'rewarded', node: BOOL },
    { id: 12, name: 'rewardX', node: METRES },
    { id: 13, name: 'rewardY', node: METRES },
    { id: 14, name: 'rewardZ', node: METRES },
    { id: 15, name: 'kind', node: TEXT, ...INITIAL },
  ],
} as const satisfies WireClass

/** The `script` class: a shard-script body's exact pose. */
const SCRIPT = {
  id: 4,
  name: 'script',
  fields: [
    { id: 1, name: 'x', node: F32, ...AT },
    { id: 2, name: 'y', node: F32, ...AT },
    { id: 3, name: 'z', node: F32, ...AT },
    { id: 4, name: 'pitch', node: ANGLE_16 },
    { id: 5, name: 'yaw', node: ANGLE_16 },
    { id: 6, name: 'roll', node: ANGLE_16 },
    { id: 7, name: 'enabled', node: BOOL },
  ],
} as const satisfies WireClass

/** The `state` class: one public shared field's exact value. */
const STATE = {
  id: 5,
  name: 'state',
  fields: [{ id: 1, name: 'value', node: F32 }],
} as const satisfies WireClass

/** The `flag` class: it exists while its flag is set; a frame carries nothing. */
const FLAG = {
  id: 6,
  name: 'flag',
  fields: [],
} as const satisfies WireClass

/** Every entity class, in the v0 wire's index order; a literal tuple. */
const WIRE_CLASSES = [
  PLAYER,
  ANIMAL,
  ENCOUNTER,
  SCRIPT,
  STATE,
  FLAG,
] as const satisfies readonly WireClass[]

export {
  ANIMAL,
  ANIMAL_STATES,
  ENCOUNTER,
  ENCOUNTER_STATES,
  FLAG,
  SCRIPT,
  STATE,
  WIRE_CLASSES,
}
export { PLAYER } from './player.ts'
