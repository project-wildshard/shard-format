// Meta MOSSGATE-ZONE MZ31 (QA 11-19 row 35, "I'm setting these lanterns and nothing happens"): a step's `feedback` and a
// Quest's `onComplete.payoff`, the rows the engine lands a quest beat from.
import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { QuestDataSchema } from './quests.ts'

/** A place in the cell, as the rows spell it. */
const spot = (json: string): unknown => JSON.parse(json)
const quest = (
  step: Readonly<Record<string, unknown>>,
  onComplete?: Readonly<Record<string, unknown>>,
): unknown => ({
  flags: ['lamp.a', 'lamp.done'],
  triggers: [],
  dialogue: [],
  quests: [
    {
      id: 'lamp',
      title: 'Relight',
      completeFlag: 'lamp.done',
      steps: [
        {
          id: 'a',
          objective: 'Light brazier A',
          done: { all: ['lamp.a'] },
          ...step,
        },
      ],
      ...(onComplete === undefined ? {} : { onComplete }),
    },
  ],
})

/** The cell's centre. */
const origin = spot('{"x":0,"z":0}')
/** Whether the rows parse. */
const admits = (rows: unknown): boolean =>
  safeParse(QuestDataSchema, rows).success

test('a step lands where it was done: its place, colour, spread and synth voice', (): void => {
  const feedback = {
    at: spot('{"x":4,"z":-6,"y":1.2}'),
    colour: '#ffa040',
    radius: 6,
    sound: 'ignite',
  }
  const rows = parse(QuestDataSchema, quest({ feedback }))
  expect(rows.quests[0]?.steps[0]?.feedback).toEqual(feedback)
  // Place only: the engine's defaults for the rest
  expect(admits(quest({ feedback: { at: origin } }))).toBe(true)
})

test('a quest pays off: a landing, its music and the next goal, beside its scene hook', (): void => {
  const payoff = {
    at: spot('{"x":1,"z":2}'),
    colour: '#fff0c0',
    radius: 14,
    sound: 'glyph',
    music: 'dawn',
    next: 'Ask the Pond Hermit about the gate',
  }
  const rows = parse(
    QuestDataSchema,
    quest({}, { fact: 'lamp', scene: 'lamp.payoff', payoff }),
  )
  expect(rows.quests[0]?.onComplete?.payoff).toEqual(payoff)
})

test('a landing refuses a recorded sound, a bad colour, a wide spread and stray keys', (): void => {
  expect(
    admits(quest({ feedback: { at: origin, sound: 'fanfare.mp3' } })),
  ).toBe(false)
  expect(admits(quest({ feedback: { at: origin, colour: 'orange' } }))).toBe(
    false,
  )
  expect(admits(quest({ feedback: { at: origin, radius: 80 } }))).toBe(false)
  expect(admits(quest({ feedback: { at: origin, flare: true } }))).toBe(false)
  expect(admits(quest({ feedback: { colour: '#ffffff' } }))).toBe(false)
  expect(admits(quest({}, { payoff: { at: origin, music: 'boss' } }))).toBe(
    false,
  )
})
