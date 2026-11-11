import { WIRE_CLASSES } from './classes.js';
import { WIRE_EVENTS } from './events.js';
import { MAX_ROW_FIELDS, rowFieldCount } from './lock.js';
import { checkFields, checkNode, checkSpace } from './node-checks.js';
import { HELLO, WELCOME, WIRE_ACTS, WIRE_COMMAND, WIRE_MESSAGES, WIRE_RECORDS, } from './records.js';
import { RIDE_LAWS } from './rides.js';
/** A ride law's id travels in 8 bits. */
const MAX_LAW_ID = 255;
/** The node kinds a class field may be: a column word, or spawn text. */
const CLASS_KINDS = new Set([
    'uint',
    'bool',
    'f32',
    'f64',
    'quant',
    'fixed',
    'angle',
    'enum',
    'ref',
    'text',
]);
function checkClassField(where, field) {
    const at = `${where}.${field.name}`;
    const { kind } = field.node;
    const owned = field.predicted === true || field.send === 'owner';
    return [
        ...(CLASS_KINDS.has(kind) ? [] : [`${at}: a ${kind} is not a column`]),
        ...(kind === 'text' && field.send !== 'initial'
            ? [`${at}: text is initial-only`]
            : []),
        ...(kind === 'f64' && !owned
            ? [`${at}: a double fits only the owner block`]
            : []),
        ...(field.predicted === true &&
            field.send !== undefined &&
            field.send !== 'all' &&
            field.send !== 'owner'
            ? [`${at}: a predicted field is the owner's`]
            : []),
    ];
}
function checkClass(wireClass) {
    const where = `class.${wireClass.name}`;
    return [
        ...checkFields(where, wireClass.fields),
        ...(rowFieldCount(wireClass) > MAX_ROW_FIELDS
            ? [`${where}: more than 32 row fields`]
            : []),
        ...wireClass.fields.flatMap((field) => checkClassField(where, field)),
    ];
}
/**
 * Each message tag has exactly one body: a cold record (hello, welcome) or a
 * record, with the same id and name, and no two bodies share an id.
 */
function checkMessageBodies(set) {
    const bodies = [...set.cold, ...set.records];
    const unmatched = [
        ...set.messages.filter((message) => !bodies.some((body) => body.id === message.id && body.name === message.name)),
        ...bodies.filter((body) => !set.messages.some((message) => body.id === message.id && body.name === message.name)),
    ];
    return [
        ...checkSpace('message bodies', bodies),
        ...unmatched.map((entry) => `messages.${entry.name}: tag ${String(entry.id)} has no matching body`),
    ];
}
/** Everything wrong with a descriptor set; empty when it is sound. */
function validateDescriptors(set) {
    return [
        ...checkSpace('messages', set.messages),
        ...checkMessageBodies(set),
        ...checkSpace('events', set.events),
        ...checkSpace('classes', set.classes),
        ...set.cold.flatMap((record) => checkSpace(`cold.${record.name}`, record.fields)),
        ...[...set.records, ...set.events].flatMap((record) => checkFields(`record.${record.name}`, record.fields)),
        ...checkNode('acts', set.acts),
        ...checkNode('command', set.command),
        ...set.classes.flatMap((wireClass) => checkClass(wireClass)),
    ];
}
/** Everything wrong with one class, as a peer's class table must be checked. */
function classProblems(wireClass) {
    return checkClass(wireClass);
}
/** Every ride law's words are f32s, so a frame carries them as v0 did. */
function rideLawProblems(laws) {
    return [
        ...checkSpace('rideLaws', laws),
        ...laws.flatMap((law) => [
            ...checkFields(`rideLaw.${law.name}`, law.fields),
            ...law.fields
                .filter((field) => field.node.kind !== 'f32')
                .map((field) => `rideLaw.${law.name}.${field.name}: a ride word is an f32`),
            ...(law.id > MAX_LAW_ID ? [`rideLaw.${law.name}: an id past 255`] : []),
        ]),
    ];
}
/** Everything wrong with the descriptors this package ships. */
function validateWire() {
    return [
        ...rideLawProblems(RIDE_LAWS),
        ...validateDescriptors({
            messages: WIRE_MESSAGES,
            cold: [HELLO, WELCOME],
            records: WIRE_RECORDS,
            events: WIRE_EVENTS,
            acts: WIRE_ACTS,
            command: WIRE_COMMAND,
            classes: WIRE_CLASSES,
        }),
    ];
}
export { classProblems, rideLawProblems, validateDescriptors, validateWire, };
