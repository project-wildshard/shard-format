import { BOOL, CHANNEL, F32, METRES, OPTIONAL_TEXT, REF, SIGNED_UNIT_8, TEXT, TICK, U16, U32, U8, } from './nodes.js';
// WIRE-STABILITY 5.1-5.3: the events in an `events` record, each its own
// tagged, length-prefixed record so an unknown one is skipped. Tags keep their
// v0 numbers; field ids are unreleased until `wire-v1.0.0`.
/** A cell-local point in 16-bit metres. */
const POINT = {
    kind: 'struct',
    fields: [
        { id: 1, name: 'x', node: METRES },
        { id: 2, name: 'y', node: METRES },
        { id: 3, name: 'z', node: METRES },
    ],
};
/** A unit direction in 8 bits per axis. */
const DIRECTION = {
    kind: 'struct',
    fields: [
        { id: 1, name: 'x', node: SIGNED_UNIT_8 },
        { id: 2, name: 'y', node: SIGNED_UNIT_8 },
        { id: 3, name: 'z', node: SIGNED_UNIT_8 },
    ],
};
/** The events in an `events` record, by their v0 event tags. */
const WIRE_EVENTS = [
    {
        id: 1,
        name: 'spawn',
        fields: [
            { id: 1, name: 'handle', node: U16 },
            { id: 2, name: 'cls', node: U8 },
            { id: 3, name: 'id', node: TEXT },
        ],
        tail: 'class-columns',
    },
    { id: 2, name: 'despawn', fields: [{ id: 1, name: 'handle', node: U16 }] },
    {
        id: 3,
        name: 'hit',
        fields: [
            TICK,
            { id: 2, name: 'target', node: REF },
            { id: 3, name: 'amount', node: F32 },
            { id: 4, name: 'at', node: POINT },
            { id: 5, name: 'head', node: BOOL },
            { id: 6, name: 'killed', node: BOOL },
            { id: 7, name: 'blow', node: BOOL },
            { id: 8, name: 'confirmFor', node: U16 },
        ],
    },
    {
        id: 4,
        name: 'died',
        fields: [
            TICK,
            { id: 2, name: 'id', node: REF },
            { id: 3, name: 'by', node: REF },
            { id: 4, name: 'dir', node: DIRECTION },
            { id: 5, name: 'impulse', node: F32 },
        ],
    },
    {
        id: 5,
        name: 'quest',
        fields: [
            TICK,
            { id: 2, name: 'quest', node: TEXT },
            { id: 3, name: 'started', node: BOOL },
            { id: 4, name: 'step', node: OPTIONAL_TEXT },
            { id: 5, name: 'n', node: U16 },
        ],
    },
    {
        id: 6,
        name: 'phase',
        fields: [
            TICK,
            { id: 2, name: 'flag', node: TEXT },
            { id: 3, name: 'on', node: BOOL },
        ],
    },
    {
        id: 7,
        name: 'reward',
        fields: [
            TICK,
            { id: 2, name: 'coins', node: U32 },
            { id: 3, name: 'body', node: REF },
            { id: 4, name: 'item', node: OPTIONAL_TEXT },
        ],
    },
    {
        id: 8,
        name: 'travel',
        fields: [
            TICK,
            { id: 2, name: 'from', node: U16 },
            { id: 3, name: 'to', node: U16 },
        ],
    },
    {
        id: 9,
        name: 'ledger',
        fields: [
            TICK,
            { id: 2, name: 'serial', node: U32 },
            { id: 3, name: 'id', node: TEXT },
            {
                id: 4,
                name: 'grant',
                node: {
                    kind: 'enum',
                    values: ['fact', 'coins', 'item'],
                    default: 'fact',
                },
            },
            { id: 5, name: 'name', node: TEXT },
            { id: 6, name: 'amount', node: F32 },
            { id: 7, name: 'pending', node: BOOL },
        ],
    },
    {
        id: 10,
        name: 'chat',
        fields: [
            TICK,
            { id: 2, name: 'line', node: U32 },
            { id: 3, name: 'channel', node: CHANNEL },
            { id: 4, name: 'from', node: REF },
            { id: 5, name: 'name', node: TEXT },
            { id: 6, name: 'text', node: TEXT },
        ],
    },
    {
        id: 11,
        name: 'mount',
        fields: [
            TICK,
            { id: 2, name: 'rider', node: REF },
            { id: 3, name: 'mount', node: REF },
            { id: 4, name: 'seq', node: U16 },
        ],
    },
    {
        id: 12,
        name: 'dismount',
        fields: [
            TICK,
            { id: 2, name: 'rider', node: REF },
            { id: 3, name: 'mount', node: REF },
            { id: 4, name: 'seq', node: U16 },
        ],
    },
    {
        id: 13,
        name: 'owned',
        fields: [
            TICK,
            { id: 2, name: 'name', node: TEXT },
            { id: 3, name: 'value', node: F32 },
        ],
    },
    {
        id: 14,
        name: 'view',
        fields: [
            TICK,
            { id: 2, name: 'name', node: TEXT },
            {
                id: 3,
                name: 'args',
                node: { kind: 'array', node: F32, maxCount: 255 },
            },
        ],
    },
    {
        id: 15,
        name: 'player-died',
        fields: [
            TICK,
            { id: 2, name: 'id', node: REF },
            { id: 3, name: 'checkpoint', node: BOOL },
            {
                id: 4,
                name: 'cause',
                node: {
                    kind: 'optional',
                    node: {
                        kind: 'struct',
                        fields: [
                            { id: 1, name: 'kind', node: TEXT },
                            { id: 2, name: 'label', node: TEXT },
                            { id: 3, name: 'text', node: OPTIONAL_TEXT },
                        ],
                    },
                },
            },
        ],
    },
];
export { WIRE_EVENTS };
