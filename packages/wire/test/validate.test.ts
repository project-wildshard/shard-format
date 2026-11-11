import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ANIMAL, WIRE_CLASSES } from '../src/classes.ts'
import { WIRE_EVENTS } from '../src/events.ts'
import {
  HELLO,
  WELCOME,
  WIRE_ACTS,
  WIRE_COMMAND,
  WIRE_MESSAGES,
  WIRE_RECORDS,
} from '../src/records.ts'
import { validateDescriptors } from '../src/validate.ts'

import type { WireClass } from '../src/grammar.ts'

const SET = {
  messages: WIRE_MESSAGES,
  cold: [HELLO, WELCOME],
  records: WIRE_RECORDS,
  events: WIRE_EVENTS,
  acts: WIRE_ACTS,
  command: WIRE_COMMAND,
  classes: WIRE_CLASSES,
}
const BOOL = { kind: 'bool' } as const
/** Two lanes each took "the next id" in animal. */
const TWICE: WireClass = {
  ...ANIMAL,
  fields: [...ANIMAL.fields, { id: 5, name: 'mood', node: BOOL }],
}
const WIDE: WireClass = {
  id: 9,
  name: 'wide',
  fields: Array.from(
    { length: 33 },
    (_unused: unknown, index: number): WireClass['fields'][number] => ({
      id: index + 1,
      name: `f${String(index)}`,
      node: BOOL,
    }),
  ),
}
const ODD: WireClass = {
  id: 10,
  name: 'odd',
  fields: [
    { id: 0, name: 'zero', node: { kind: 'uint', bits: 33 } },
    {
      id: 1,
      name: 'mode',
      node: { kind: 'enum', values: ['a', 'b'], default: 'c' },
    },
    { id: 2, name: 'label', node: { kind: 'text', maxBytes: 255 } },
  ],
}
const ODD_PROBLEMS = [
  'class.odd.zero: id 0 is not > 0',
  'class.odd.zero: 33 bits is outside 1 to 32',
  'class.odd.mode: default c is not a declared value',
  'class.odd.label: text is initial-only',
]

test('the shipped descriptors are sound', (): void => {
  assert.deepEqual(validateDescriptors(SET), [])
})

test('a message body sharing a tag, or an arm id past its bits, refuses', (): void => {
  const [cmds, act, ...rest] = WIRE_RECORDS
  assert.deepEqual(
    validateDescriptors({
      ...SET,
      records: [cmds, { ...act, id: 2 }, ...rest],
      acts: { ...WIRE_ACTS, bits: 3 },
    }),
    [
      'message bodies: id 2 is both cmds and act',
      'messages.act: tag 3 has no matching body',
      'messages.act: tag 2 has no matching body',
      'acts.buy: arm id 8 needs more than 3 bits',
      'acts.board: arm id 9 needs more than 3 bits',
      'acts.wear: arm id 10 needs more than 3 bits',
      'acts.pose: arm id 11 needs more than 3 bits',
    ],
  )
})

test('duplicate ids, unbounded nodes and bad defaults refuse', (): void => {
  assert.deepEqual(
    validateDescriptors({
      ...SET,
      classes: [ANIMAL, TWICE, WIDE, ODD, { ...ODD, id: 2 }],
    }),
    [
      'classes: id 2 is both animal and animal',
      'classes: id 2 is both animal and odd',
      'class.animal: id 5 is both state and mood',
      'class.wide: more than 32 row fields',
      ...ODD_PROBLEMS,
      ...ODD_PROBLEMS,
    ],
  )
})
