import {
  array,
  boolean,
  looseObject,
  number,
  object,
  parse,
  string,
} from 'valibot'

import { WIRE_CLASSES } from '../src/classes.ts'
import { WIRE_EVENTS } from '../src/events.ts'
import { wireLockText } from '../src/lock.ts'
import { WIRE_ACTS, WIRE_COMMAND, WIRE_MESSAGES } from '../src/records.ts'
import { v0Field } from '../src/v0-field.ts'
import { v0Description } from '../src/v0.ts'
import { validateWire } from '../src/validate.ts'
import {
  classifyTokens,
  renderCommandField,
  renderField,
  splitForm,
} from './forms.ts'

import type { WireClass, WireClassField, WireField } from '../src/grammar.ts'
import type { Classification } from './forms.ts'

// `wire check` (WIRE-STABILITY 7, the WR2 part): the descriptors are sound,
// the committed lock is what they generate, and against the WS2 v0 baseline
// every class field keeps its id and v0 form, every tag keeps its name, every
// event, act and command field keeps its form in v1's words (forms.ts), and
// whatever is new is an addition. WR6 adds the release-diff rules.

const TaggedSchema = object({ tag: number(), name: string(), form: string() })
const BaselineFieldSchema = looseObject({
  id: number(),
  name: string(),
  send: string(),
  predicted: boolean(),
})
const BaselineClassSchema = object({
  v0Index: number(),
  v1Id: number(),
  name: string(),
  fields: array(BaselineFieldSchema),
})
const TaggedList = array(TaggedSchema)
const CommandSchema = looseObject({ fields: array(string()) })
const BaselineLockSchema = looseObject({
  descriptions: array(string()),
  classes: array(BaselineClassSchema),
  messages: TaggedList,
  events: TaggedList,
  acts: TaggedList,
  command: CommandSchema,
})

interface TaggedEntry {
  readonly tag: number
  readonly name: string
  readonly form: string
}
/** A v1 tag, and its body's fields when its v0 body is compared. */
interface TaggedNow {
  readonly id: number
  readonly name: string
  readonly fields?: readonly WireField[]
}
/** A baseline field: its id, name and the v0 form keys. */
interface BaselineFieldForm {
  readonly id: number
  readonly name: string
  readonly [key: string]: unknown
}
interface BaselineClass {
  readonly v0Index: number
  readonly v1Id: number
  readonly name: string
  readonly fields: readonly BaselineFieldForm[]
}
/** The WS2 baseline lock, as far as classification reads it. */
interface BaselineLock {
  readonly descriptions: readonly string[]
  readonly classes: readonly BaselineClass[]
  readonly messages: readonly TaggedEntry[]
  readonly events: readonly TaggedEntry[]
  readonly acts: readonly TaggedEntry[]
  readonly command: { readonly fields: readonly string[] }
}

const NOTHING: Classification = { kept: 0, added: [], problems: [] }
const ONE = 1

const V0_FORM_KEYS = [
  'kind',
  'min',
  'max',
  'bits',
  'values',
  'send',
  'predicted',
] as const
function merge(parts: readonly Classification[]): Classification {
  return {
    kept: parts.reduce(
      (sum: number, part: Classification): number => sum + part.kept,
      NOTHING.kept,
    ),
    added: parts.flatMap(
      (part: Classification): readonly string[] => part.added,
    ),
    problems: parts.flatMap(
      (part: Classification): readonly string[] => part.problems,
    ),
  }
}

function sameForm(field: WireClassField, old: BaselineFieldForm): boolean {
  const now: Readonly<Record<string, unknown>> = {
    ...v0Field(field),
    send: field.send ?? 'all',
    predicted: field.predicted === true,
  }
  return V0_FORM_KEYS.every(
    (key: (typeof V0_FORM_KEYS)[number]): boolean =>
      JSON.stringify(now[key]) === JSON.stringify(old[key]),
  )
}

function classifyField(now: WireClass, old: BaselineFieldForm): Classification {
  const match = now.fields.find(
    (entry: WireClassField): boolean => entry.id === old.id,
  )
  return match?.name === old.name && sameForm(match, old)
    ? { ...NOTHING, kept: ONE }
    : { ...NOTHING, problems: [`${now.name}.${old.name} changed or is gone`] }
}

/** The class without what was added since the baseline. */
function baselineShape(now: WireClass, old: BaselineClass): WireClass {
  const known = new Set(
    old.fields.map((field: BaselineFieldForm): number => field.id),
  )
  return {
    ...now,
    fields: now.fields.filter((field: WireClassField): boolean =>
      known.has(field.id),
    ),
  }
}

function classifyClass(
  old: BaselineClass,
  description: string | undefined,
): Classification {
  const now = WIRE_CLASSES.find(
    (entry: WireClass): boolean => entry.id === old.v1Id,
  )
  if (now?.name !== old.name) {
    return {
      ...NOTHING,
      problems: [`class ${old.name} (#${String(old.v1Id)}) is gone`],
    }
  }
  const shape = baselineShape(now, old)
  const added = now.fields.filter(
    (field: WireClassField): boolean => !shape.fields.includes(field),
  )
  // Without its additions, the class still writes the baseline's v0 text.
  const moved =
    v0Description(shape) === description
      ? []
      : [`${old.name}: v0 order or text moved`]
  return merge([
    ...old.fields.map((field: BaselineFieldForm): Classification =>
      classifyField(now, field),
    ),
    {
      kept: NOTHING.kept,
      added: added.map(
        (field: WireClassField): string =>
          `${old.name}.${field.name} #${String(field.id)}`,
      ),
      problems: moved,
    },
  ])
}

function classifyTag(
  space: string,
  old: TaggedEntry,
  now: readonly TaggedNow[],
): Classification {
  const match = now.find((item: TaggedNow): boolean => item.id === old.tag)
  if (match?.name !== old.name) {
    return {
      ...NOTHING,
      problems: [`${space} ${old.name} (#${String(old.tag)}) moved`],
    }
  }
  const tag = { ...NOTHING, kept: ONE }
  // Message bodies are redone at the major cut (J197); event and act bodies
  // keep every v0 field, in v1's words.
  return match.fields === undefined
    ? tag
    : merge([
        tag,
        classifyTokens(
          `${space} ${old.name}`,
          splitForm(old.form),
          match.fields.map((field: WireField): string => renderField(field)),
        ),
      ])
}

function classifyTags(
  space: string,
  old: readonly TaggedEntry[],
  now: readonly TaggedNow[],
): Classification {
  const known = new Set(old.map((entry: TaggedEntry): number => entry.tag))
  const added = now
    .filter((entry: TaggedNow): boolean => !known.has(entry.id))
    .map(
      (entry: TaggedNow): string =>
        `${space}.${entry.name} #${String(entry.id)}`,
    )
  return merge([
    ...old.map((entry: TaggedEntry): Classification =>
      classifyTag(space, entry, now),
    ),
    { ...NOTHING, added },
  ])
}

const MESSAGE_TAGS: readonly TaggedNow[] = WIRE_MESSAGES.map(
  (message: TaggedNow): TaggedNow => ({ id: message.id, name: message.name }),
)

/** Compare the descriptors with the WS2 v0 baseline. */
function classifyAgainstBaseline(baseline: BaselineLock): Classification {
  return merge([
    ...baseline.classes.map((old: BaselineClass): Classification =>
      classifyClass(old, baseline.descriptions[old.v0Index]),
    ),
    classifyTags('message', baseline.messages, MESSAGE_TAGS),
    classifyTags('event', baseline.events, WIRE_EVENTS),
    classifyTags('act', baseline.acts, WIRE_ACTS.arms),
    classifyTokens(
      'command',
      baseline.command.fields,
      WIRE_COMMAND.fields.flatMap((field: WireField): readonly string[] =>
        renderCommandField(field, ''),
      ),
    ),
  ])
}

/** Every reason `wire check` fails, plus what it classified. */
function checkWire(committedLock: string, baseline: unknown): Classification {
  const problems = validateWire()
  const stale =
    wireLockText() === committedLock
      ? []
      : ['wire.lock.json is stale: run `pnpm lock` and commit it']
  const classified = classifyAgainstBaseline(
    parse(BaselineLockSchema, baseline),
  )
  return {
    ...classified,
    problems: [...problems, ...stale, ...classified.problems],
  }
}

export { checkWire, classifyAgainstBaseline }
