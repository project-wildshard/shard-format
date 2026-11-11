import { array, boolean, looseObject, number, object, parse, string, } from 'valibot';
import { WIRE_CLASSES } from '../src/classes.js';
import { WIRE_EVENTS } from '../src/events.js';
import { wireLockText } from '../src/lock.js';
import { HELLO, RIDE_LAWS, WELCOME, WIRE_ACTS, WIRE_COMMAND, WIRE_MESSAGES, WIRE_RECORDS, } from '../src/records.js';
import { v0Field } from '../src/v0-field.js';
import { v0Description } from '../src/v0.js';
import { rideLawProblems, validateDescriptors } from '../src/validate.js';
import { classifyTokens, renderCommandField, renderField, splitForm, } from './forms.js';
// `wire check` (WIRE-STABILITY 7, the WR2 part): the descriptors are sound,
// the committed lock is what they generate, and against the WS2 v0 baseline
// every class field keeps its id and v0 form, every tag keeps its name, every
// event, act and command field keeps its form in v1's words (forms.ts), and
// whatever is new is an addition. WR6 adds the release-diff rules.
const TaggedSchema = object({ tag: number(), name: string(), form: string() });
const BaselineFieldSchema = looseObject({
    id: number(),
    name: string(),
    send: string(),
    predicted: boolean(),
});
const BaselineClassSchema = object({
    v0Index: number(),
    v1Id: number(),
    name: string(),
    fields: array(BaselineFieldSchema),
});
const TaggedList = array(TaggedSchema);
const CommandSchema = looseObject({ fields: array(string()) });
const BaselineLockSchema = looseObject({
    descriptions: array(string()),
    classes: array(BaselineClassSchema),
    messages: TaggedList,
    events: TaggedList,
    acts: TaggedList,
    command: CommandSchema,
});
const NOTHING = { kept: 0, added: [], problems: [] };
const ONE = 1;
const V0_FORM_KEYS = [
    'kind',
    'min',
    'max',
    'bits',
    'values',
    'send',
    'predicted',
];
function merge(parts) {
    return {
        kept: parts.reduce((sum, part) => sum + part.kept, NOTHING.kept),
        added: parts.flatMap((part) => part.added),
        problems: parts.flatMap((part) => part.problems),
    };
}
function sameForm(field, old) {
    const now = {
        ...v0Field(field),
        send: field.send ?? 'all',
        predicted: field.predicted === true,
    };
    return V0_FORM_KEYS.every((key) => JSON.stringify(now[key]) === JSON.stringify(old[key]));
}
function classifyField(now, old) {
    const match = now.fields.find((entry) => entry.id === old.id);
    return match?.name === old.name && sameForm(match, old)
        ? { ...NOTHING, kept: ONE }
        : { ...NOTHING, problems: [`${now.name}.${old.name} changed or is gone`] };
}
/** The class without what was added since the baseline. */
function baselineShape(now, old) {
    const known = new Set(old.fields.map((field) => field.id));
    return {
        ...now,
        fields: now.fields.filter((field) => known.has(field.id)),
    };
}
function classifyClass(old, description) {
    const now = WIRE_CLASSES.find((entry) => entry.id === old.v1Id);
    if (now?.name !== old.name) {
        return {
            ...NOTHING,
            problems: [`class ${old.name} (#${String(old.v1Id)}) is gone`],
        };
    }
    const shape = baselineShape(now, old);
    const added = now.fields.filter((field) => !shape.fields.includes(field));
    // Without its additions, the class still writes the baseline's v0 text.
    const moved = v0Description(shape) === description
        ? []
        : [`${old.name}: v0 order or text moved`];
    return merge([
        ...old.fields.map((field) => classifyField(now, field)),
        {
            kept: NOTHING.kept,
            added: added.map((field) => `${old.name}.${field.name} #${String(field.id)}`),
            problems: moved,
        },
    ]);
}
function classifyTag(space, old, now) {
    const match = now.find((item) => item.id === old.tag);
    if (match?.name !== old.name) {
        return {
            ...NOTHING,
            problems: [`${space} ${old.name} (#${String(old.tag)}) moved`],
        };
    }
    const tag = { ...NOTHING, kept: ONE };
    // Message bodies are redone at the major cut (J197); event and act bodies
    // keep every v0 field, in v1's words.
    return match.fields === undefined
        ? tag
        : merge([
            tag,
            classifyTokens(`${space} ${old.name}`, splitForm(old.form), match.fields.map((field) => renderField(field))),
        ]);
}
function classifyTags(space, old, now) {
    const known = new Set(old.map((entry) => entry.tag));
    const added = now
        .filter((entry) => !known.has(entry.id))
        .map((entry) => `${space}.${entry.name} #${String(entry.id)}`);
    return merge([
        ...old.map((entry) => classifyTag(space, entry, now)),
        { ...NOTHING, added },
    ]);
}
const MESSAGE_TAGS = WIRE_MESSAGES.map((message) => ({ id: message.id, name: message.name }));
/** Compare the descriptors with the WS2 v0 baseline. */
function classifyAgainstBaseline(baseline) {
    return merge([
        ...baseline.classes.map((old) => classifyClass(old, baseline.descriptions[old.v0Index])),
        classifyTags('message', baseline.messages, MESSAGE_TAGS),
        classifyTags('event', baseline.events, WIRE_EVENTS),
        classifyTags('act', baseline.acts, WIRE_ACTS.arms),
        classifyTokens('command', baseline.command.fields, WIRE_COMMAND.fields.flatMap((field) => renderCommandField(field, ''))),
    ]);
}
/** Every reason `wire check` fails, plus what it classified. */
function checkWire(committedLock, baseline) {
    const problems = [
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
    const stale = wireLockText() === committedLock
        ? []
        : ['wire.lock.json is stale: run `pnpm lock` and commit it'];
    const classified = classifyAgainstBaseline(parse(BaselineLockSchema, baseline));
    return {
        ...classified,
        problems: [...problems, ...stale, ...classified.problems],
    };
}
export { checkWire, classifyAgainstBaseline };
