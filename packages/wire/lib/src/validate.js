import { MAX_ROW_FIELDS, rowFieldCount } from './lock.js';
import { checkFields, checkNode, checkSpace } from './node-checks.js';
function checkClassField(where, field) {
    return field.node.kind === 'text' && field.send !== 'initial'
        ? [`${where}.${field.name}: text is initial-only`]
        : [];
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
export { validateDescriptors };
