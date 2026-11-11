import { RIDE_ACTIONS } from './net-command.js';
import { AXIS, BOOL, CHANNEL, F32, PITCH, REF, TEXT, TICK, U16, U32, U5, U8, UNIT_8, } from './nodes.js';
// WIRE-STABILITY 5.1-5.3: every record, act and command in the 5.3 grammar.
// Message, event and act tags keep their v0 numbers (5.2). Field ids are
// unreleased until `wire-v1.0.0`; after that tag they are append-only.
const OPTIONAL_REF = { kind: 'optional', node: REF };
const TEXT_IN_BYTES = { wire: 'bytes', holds: 'text' };
const TABLES = { wire: 'bytes', holds: 'tables' };
const IDS = { wire: 'bytes', holds: 'ids' };
const NEEDED = { wire: 'uvarint', required: true };
/** An exact world vector. */
const VECTOR = {
    kind: 'struct',
    fields: [
        { id: 1, name: 'x', node: F32 },
        { id: 2, name: 'y', node: F32 },
        { id: 3, name: 'z', node: F32 },
    ],
};
/** The top-level message tags (`MSG_*`). */
const WIRE_MESSAGES = [
    { id: 1, name: 'hello', singleton: true },
    { id: 2, name: 'cmds', singleton: true },
    { id: 3, name: 'act', singleton: true },
    { id: 4, name: 'welcome', singleton: true },
    { id: 5, name: 'frame', singleton: true },
    { id: 6, name: 'events', singleton: false },
];
/** `hello`: the client's version, identity and tables (5.3). */
const HELLO = {
    id: 1,
    name: 'hello',
    fields: [
        { id: 1, name: 'minor', ...NEEDED },
        { id: 2, name: 'build', ...TEXT_IN_BYTES },
        { id: 3, name: 'player', ...TEXT_IN_BYTES, required: true },
        { id: 4, name: 'name', ...TEXT_IN_BYTES },
        { id: 5, name: 'ledger', wire: 'uvarint' },
        { id: 6, name: 'capabilities', ...IDS },
        { id: 7, name: 'commandTable', ...TABLES, required: true },
        { id: 8, name: 'actTable', ...TABLES, required: true },
    ],
};
/** `welcome`: the server's version, the seat, and its tables (5.3). */
const WELCOME = {
    id: 4,
    name: 'welcome',
    fields: [
        { id: 1, name: 'minor', ...NEEDED },
        { id: 2, name: 'build', ...TEXT_IN_BYTES },
        { id: 3, name: 'handle', ...NEEDED },
        { id: 4, name: 'player', ...TEXT_IN_BYTES, required: true },
        { id: 5, name: 'tick', ...NEEDED },
        { id: 6, name: 'cell', ...NEEDED },
        { id: 7, name: 'simHz', ...NEEDED },
        { id: 8, name: 'frameHz', ...NEEDED },
        { id: 9, name: 'capabilities', ...IDS },
        { id: 10, name: 'requiredCapabilities', ...IDS },
        { id: 11, name: 'tableHash', wire: 'fixed32', required: true },
        // Omitted on a travel welcome whose tableHash this socket already holds.
        { id: 12, name: 'classTables', ...TABLES },
        { id: 13, name: 'eventTables', ...TABLES },
        { id: 14, name: 'rideLawTables', ...TABLES },
    ],
};
/** The climate act's ops. */
const CLIMATE_OPS = ['mode', 'force', 'time', 'day'];
/** Every act a client may send, by its v0 act tag (format's and engine's). */
const WIRE_ACTS = {
    kind: 'union',
    bits: 8,
    default: 'interact',
    arms: [
        { id: 1, name: 'interact', fields: [{ id: 1, name: 'id', node: TEXT }] },
        { id: 2, name: 'reload', fields: [{ id: 1, name: 'slot', node: U8 }] },
        { id: 3, name: 'equip', fields: [{ id: 1, name: 'slot', node: U8 }] },
        {
            id: 4,
            name: 'chat',
            fields: [
                { id: 1, name: 'channel', node: CHANNEL },
                { id: 2, name: 'text', node: TEXT },
            ],
        },
        { id: 5, name: 'report', fields: [{ id: 1, name: 'line', node: U32 }] },
        {
            id: 6,
            name: 'ride',
            fields: [
                {
                    id: 1,
                    name: 'action',
                    node: { kind: 'enum', values: RIDE_ACTIONS, default: 'offer' },
                },
            ],
        },
        {
            id: 7,
            name: 'climate',
            fields: [
                {
                    id: 1,
                    name: 'op',
                    node: { kind: 'enum', values: CLIMATE_OPS, default: 'mode' },
                },
                { id: 2, name: 'name', node: TEXT },
                { id: 3, name: 'at', node: F32 },
            ],
        },
        { id: 8, name: 'buy', fields: [{ id: 1, name: 'good', node: U16 }] },
        {
            id: 9,
            name: 'board',
            fields: [
                {
                    id: 1,
                    name: 'op',
                    node: { kind: 'enum', values: ['claim', 'tear'], default: 'claim' },
                },
                { id: 2, name: 'slot', node: U16 },
            ],
        },
        { id: 10, name: 'wear', fields: [{ id: 1, name: 'id', node: TEXT }] },
        { id: 11, name: 'pose', fields: [{ id: 1, name: 'names', node: TEXT }] },
    ],
};
/** One client sim step of input (`NetCommand`), in the 5.3 grammar. */
const WIRE_COMMAND = {
    kind: 'struct',
    fields: [
        { id: 1, name: 'seq', node: U16 },
        { id: 2, name: 'viewTick', node: U16 },
        {
            id: 3,
            name: 'steer',
            node: {
                kind: 'struct',
                fields: [
                    { id: 1, name: 'keyX', node: AXIS },
                    { id: 2, name: 'keyY', node: AXIS },
                    { id: 3, name: 'stickX', node: AXIS },
                    { id: 4, name: 'stickY', node: AXIS },
                ],
            },
        },
        { id: 4, name: 'yaw', node: { kind: 'angle', bits: 16 } },
        { id: 5, name: 'pitch', node: PITCH },
        { id: 6, name: 'buttons', node: U8 },
        { id: 7, name: 'buttonsHigh', node: { kind: 'optional', node: U8 } },
        {
            id: 8,
            name: 'attack',
            node: {
                kind: 'optional',
                node: {
                    kind: 'struct',
                    fields: [
                        { id: 1, name: 'targetId', node: OPTIONAL_REF },
                        {
                            id: 2,
                            name: 'aim',
                            node: {
                                kind: 'struct',
                                fields: [
                                    { id: 1, name: 'origin', node: VECTOR },
                                    { id: 2, name: 'direction', node: VECTOR },
                                ],
                            },
                        },
                    ],
                },
            },
        },
        { id: 9, name: 'heavyTarget', node: OPTIONAL_REF },
        { id: 10, name: 'lockTarget', node: OPTIONAL_REF },
        { id: 11, name: 'hookTarget', node: { kind: 'optional', node: U16 } },
        {
            id: 12,
            name: 'launcher',
            node: {
                kind: 'optional',
                node: {
                    kind: 'struct',
                    fields: [
                        { id: 1, name: 'slot', node: U5 },
                        { id: 2, name: 'ads', node: UNIT_8 },
                        { id: 3, name: 'fire', node: BOOL },
                    ],
                },
            },
        },
    ],
};
/** The most commands one `cmds` bundle carries (`MAX_BUNDLE`). */
const MAX_BUNDLE = 7;
/** The single-record bodies: `cmds`, `act`, `frame` and `events`. */
const WIRE_RECORDS = [
    {
        id: 2,
        name: 'cmds',
        fields: [
            { id: 1, name: 'ackFrame', node: U32 },
            {
                id: 2,
                name: 'commands',
                node: { kind: 'array', node: WIRE_COMMAND, maxCount: MAX_BUNDLE },
            },
        ],
    },
    {
        id: 3,
        name: 'act',
        fields: [
            { id: 1, name: 'seq', node: U16 },
            { id: 2, name: 'act', node: WIRE_ACTS },
        ],
    },
    {
        id: 5,
        name: 'frame',
        fields: [
            TICK,
            { id: 2, name: 'baseline', node: U32 },
            { id: 3, name: 'cell', node: U16 },
            { id: 4, name: 'lastSeq', node: U16 },
        ],
        tail: 'snapshot',
    },
    { id: 6, name: 'events', fields: [TICK], tail: 'records' },
];
export { CLIMATE_OPS, HELLO, MAX_BUNDLE, WELCOME, WIRE_ACTS, WIRE_COMMAND, WIRE_MESSAGES, WIRE_RECORDS, };
