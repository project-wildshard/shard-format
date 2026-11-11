// The WS2 baseline writes each v0 event, act and command as a form string,
// such as `tick:u32,target:u16,amount:f32`. These render a v1 descriptor in
// the same words, so classification compares bodies field by field. The v0
// words `ref16` and `u16` name the same 16-bit handle. Where v1 says a v0
// field another way on purpose (J197's redo at the major cut), the table
// below names both: a presence bit becomes `optional`, a flag or byte
// becomes an `enum`. A v0 field missing from it must render identically.
const XYZ = ['x', 'y', 'z'];
const AXES = 3;
const FRAMING = '';
const HALVES = 2;
const RIGHT_ANGLE = Math.PI / HALVES;
const ZERO = 0;
const IN = 1;
const OUT = -1;
const MISSING = -1;
/** Baseline form token to its v1 rendering; empty: v0 framing alone. */
const TRANSLATION_ROWS = [
    [
        'event spawn',
        [
            ['initial:classWidths', FRAMING],
            ['text:classText', FRAMING],
        ],
    ],
    [
        'event quest',
        [
            ['hasStep:bool', FRAMING],
            ['step:text', 'step?:text'],
        ],
    ],
    ['event reward', [['hasItem:bool', FRAMING]]],
    ['event ledger', [['grant:u2', 'grant:enum[fact,coins,item]']]],
    ['event chat', [['proximity:bool', 'channel:enum[room,proximity]']]],
    [
        'event view',
        [
            ['count:u8', FRAMING],
            ['args:f32[count]', 'args:f32[255]'],
        ],
    ],
    [
        'event player-died',
        [
            ['hasCause:bool', FRAMING],
            [
                'cause?:{kind:text,label:text,hasText:bool,text?:text}',
                'cause?:{kind:text,label:text,text?:text}',
            ],
        ],
    ],
    ['act chat', [['proximity:bool', 'channel:enum[room,proximity]']]],
    [
        'act ride',
        [['action:u8[offer,mount,dismount]', 'action:enum[offer,mount,dismount]']],
    ],
    [
        'act climate',
        [['op:u8[mode,force,time,day]', 'op:enum[mode,force,time,day]']],
    ],
    ['act board', [['tear:bool', 'op:enum[claim,tear]']]],
    [
        'command',
        [
            [
                'pitch:quant(-pi/2,pi/2,16)',
                `pitch:quant(${String(-RIGHT_ANGLE)},${String(RIGHT_ANGLE)},16)`,
            ],
            ['buttons.low:u8', 'buttons:u8'],
            ['buttons.high?:presence(1)+u8', 'buttonsHigh?:u8'],
            ['presence:attack,heavyTarget,lockTarget,hookTarget,launcher', FRAMING],
            [
                'attack?:hasTarget:bool,targetId?:u16,aim.origin:f32[3],aim.direction:f32[3]',
                'attack?:targetId?:u16,aim.origin:f32[3],aim.direction:f32[3]',
            ],
        ],
    ],
];
const TRANSLATIONS = new Map(TRANSLATION_ROWS.map(([space, pairs]) => [
    space,
    new Map(pairs),
]));
/** A 3-axis struct of one node renders as v0's `node[3]`. */
function axisNode(fields) {
    const [first] = fields;
    const same = fields.length === AXES &&
        fields.every((field, index) => field.name === XYZ[index] &&
            JSON.stringify(field.node) === JSON.stringify(first?.node));
    return same ? first?.node : undefined;
}
/** A leaf node in the baseline's words. */
function renderLeaf(node) {
    switch (node.kind) {
        case 'uint': {
            return `u${String(node.bits)}`;
        }
        case 'ref': {
            return 'u16';
        }
        case 'quant': {
            return `quant(${String(node.min)},${String(node.max)},${String(node.bits)})`;
        }
        case 'fixed': {
            return `fixed(${String(node.bits)},divisor=${String(node.divisor)},offset=${String(node.offset)})`;
        }
        case 'angle': {
            return `angle(${String(node.bits)})`;
        }
        case 'enum': {
            return `enum[${node.values.join(',')}]`;
        }
        case 'union': {
            return `union(${String(node.bits)})`;
        }
        case 'bool':
        case 'f32':
        case 'f64':
        case 'text':
        case 'optional':
        case 'array':
        case 'struct': {
            return node.kind;
        }
        default: {
            throw new RangeError('Unknown wire node');
        }
    }
}
/** One node in the baseline's words. */
function renderNode(node) {
    if (node.kind === 'optional') {
        return renderNode(node.node);
    }
    if (node.kind === 'array') {
        return `${renderNode(node.node)}[${String(node.maxCount)}]`;
    }
    // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
    return node.kind === 'struct' ? renderStruct(node.fields) : renderLeaf(node);
}
/** A struct: `node[3]` for x, y and z of one node, else `{field,...}`. */
function renderStruct(fields) {
    const axis = axisNode(fields);
    if (axis !== undefined) {
        return `${renderNode(axis)}[3]`;
    }
    const inner = [];
    for (const field of fields) {
        // oxlint-disable-next-line no-use-before-define -- the grammar is recursive
        inner.push(renderField(field));
    }
    return `{${inner.join(',')}}`;
}
/** One field: `name:form`, or `name?:form` when optional. */
function renderField(field) {
    const mark = field.node.kind === 'optional' ? '?' : '';
    return `${field.name}${mark}:${renderNode(field.node)}`;
}
/** A command's top-level struct flattens into dotted paths, as WS2 wrote it. */
function renderCommandField(field, prefix) {
    const { node } = field;
    const path = `${prefix}${field.name}`;
    if (node.kind === 'struct' && axisNode(node.fields) === undefined) {
        return node.fields.flatMap((inner) => renderCommandField(inner, `${path}.`));
    }
    if (node.kind === 'optional' && node.node.kind === 'struct') {
        const inner = node.node.fields.flatMap((child) => renderCommandField(child, ''));
        return [`${path}?:${inner.join(',')}`];
    }
    return [`${prefix}${renderField(field)}`];
}
/** How a bracket moves the nesting depth of a form. */
const DEPTH = new Map([
    ['{', IN],
    ['(', IN],
    ['[', IN],
    ['}', OUT],
    [')', OUT],
    [']', OUT],
]);
/** A baseline form split into its top-level fields. */
function splitForm(form) {
    const tokens = [];
    let depth = ZERO;
    let current = '';
    for (const char of form) {
        if (char === ',' && depth === ZERO) {
            tokens.push(current);
            current = '';
        }
        else {
            depth += DEPTH.get(char) ?? ZERO;
            current += char;
        }
    }
    return current === '' ? tokens : [...tokens, current];
}
/** A baseline token in v1's words: normalized, then translated. */
function translate(space, token) {
    const normal = token.replaceAll('ref16', 'u16');
    return TRANSLATIONS.get(space)?.get(normal) ?? normal;
}
/**
 * Compare one baseline body with v1's rendering of it: each v0 field is kept,
 * framing alone, or a problem; each v1 field no v0 field matched is added.
 */
function classifyTokens(space, old, now) {
    const left = [...now];
    const missing = [];
    for (const token of old) {
        const wanted = translate(space, token);
        const at = left.indexOf(wanted);
        if (wanted !== FRAMING && at === MISSING) {
            missing.push(`${space}: ${token} changed or is gone`);
        }
        else if (wanted !== FRAMING) {
            left.splice(at, IN);
        }
    }
    return {
        kept: old.length - missing.length,
        added: left.map((token) => `${space}: ${token}`),
        problems: missing,
    };
}
export { classifyTokens, renderCommandField, renderField, splitForm, };
