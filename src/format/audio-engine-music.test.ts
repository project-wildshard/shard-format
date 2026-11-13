import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { AudioMusicSchema } from './audioProfiles.ts'
import {
  ENGINE_MUSIC_SLOTS,
  ENGINE_SLOTS_MESSAGE,
  engineMusicSlots,
} from './engine-music.ts'

// AUDIO AU18 (J304): a shard names the engine music it plays by slot; the
// engine has one style, and these are its slots.

const SET_CATALOGUE = {
  inventory: 'title',
  priority: true,
  bootSynth: true,
  titleStings: false,
  baseSamples: false,
  cueOverlay: false,
}

const score = (
  over: Readonly<Record<string, unknown>>,
): Record<string, unknown> => ({
  id: 'score.x',
  base: 'island',
  slots: ['island'],
  bootSlots: ['title', 'island'],
  synthLead: 'marimba',
  minFade: 0,
  // oxlint-disable-next-line unicorn/no-null -- A score with no source of its own declares null.
  source: null,
  sets: { island: 'base' },
  selection: [{ slots: ['island'], when: [] }],
  selectMode: 'first',
  ...over,
})

const slotsOf = (input: Readonly<Record<string, unknown>>): string[] => {
  const parsed = safeParse(AudioMusicSchema, input)
  if (!parsed.success) {
    throw new Error(parsed.issues[0].message)
  }
  return engineMusicSlots(parsed.output)
}

const refusal = (input: Readonly<Record<string, unknown>>): string => {
  const parsed = safeParse(AudioMusicSchema, input)
  return parsed.success ? '' : parsed.issues[0].message
}

test('Driftwood plays the engine title and island', (): void => {
  expect(slotsOf(score({}))).toEqual(['title', 'island'])
})

test("Pine plays the engine's pine slot; its own sets are not engine music", (): void => {
  const pine = score({
    base: 'pine',
    slots: ['pine', 'night', 'boss'],
    bootSlots: ['title', 'pine'],
    sets: { pine: 'base', night: 'pine-hollow', boss: 'pine-hollow' },
    selection: [{ slots: ['pine'], when: [] }],
  })
  expect(slotsOf(pine)).toEqual(['title', 'pine'])
})

test('a slot left out of sets is an engine slot, so an unknown one is refused', (): void => {
  const harbor = score({
    base: 'harbor',
    slots: ['harbor'],
    bootSlots: ['title'],
    sets: {},
    selection: [{ slots: ['harbor'], when: [] }],
  })
  expect(refusal(harbor)).toContain('title, island or pine')
})

test('a slot set to base by name is refused when the engine has no such slot', (): void => {
  const harbor = score({
    base: 'harbor',
    slots: ['harbor'],
    bootSlots: ['title'],
    sets: { harbor: 'base' },
    selection: [{ slots: ['harbor'], when: [] }],
  })
  expect(refusal(harbor)).toContain('J304')
})

test('a set-catalogue score plays only the engine title beside its own source', (): void => {
  const own = score({
    base: 'score',
    slots: ['score'],
    bootSlots: ['title'],
    sets: {},
    source: { dir: '/assets/music/coral-drift/', manifestKey: 'coral-drift' },
    setCatalogue: SET_CATALOGUE,
    selection: [{ slots: ['score'], when: [] }],
  })
  expect(slotsOf(own)).toEqual(['title'])
})

test('the refusal names every engine slot', (): void => {
  for (const slot of ENGINE_MUSIC_SLOTS) {
    expect(ENGINE_SLOTS_MESSAGE).toContain(slot)
  }
})
