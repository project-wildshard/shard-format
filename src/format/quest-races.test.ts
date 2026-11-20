import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { QuestDataSchema, questDataRules } from './quests.ts'

const base = {
  flags: ['gate.start', 'gate.end'],
  quests: [],
  triggers: [],
  dialogue: [],
}
const race = {
  id: 'arch-run',
  start: 'gate.start',
  stop: 'gate.end',
  fact: 'arch-run.time',
  cap: 90,
}

test('quests.races admits a race over declared flags', (): void => {
  expect(parse(QuestDataSchema, { ...base, races: [race] }).races).toEqual([
    race,
  ])
})

test('a race refuses an undeclared flag, a shared start and stop, or a repeated id', (): void => {
  expect(
    questDataRules({ ...base, races: [{ ...race, start: 'gate.nope' }] }),
  ).toContain('undeclared quest flag gate.nope')
  expect(
    questDataRules({ ...base, races: [{ ...race, stop: 'gate.missing' }] }),
  ).toContain('undeclared quest flag gate.missing')
  expect(
    questDataRules({ ...base, races: [{ ...race, stop: 'gate.start' }] }),
  ).toContain('race arch-run starts and stops on one flag')
  expect(questDataRules({ ...base, races: [race, race] })).toContain(
    'unique declaration ids',
  )
  expect(questDataRules({ ...base, races: [race] })).toEqual([])
  expect(
    safeParse(QuestDataSchema, {
      ...base,
      races: [{ ...race, start: 'gate.nope' }],
    }).success,
  ).toBe(false)
})

test('a race cap is whole seconds from 1 to 3600', (): void => {
  const admits = (cap: number): boolean =>
    safeParse(QuestDataSchema, { ...base, races: [{ ...race, cap }] }).success
  expect([0, 3601, 1.5, -1].map((cap): boolean => admits(cap))).toEqual([
    false,
    false,
    false,
    false,
  ])
  expect([1, 3600].map((cap): boolean => admits(cap))).toEqual([true, true])
  expect(
    safeParse(QuestDataSchema, { ...base, races: [{ ...race, extra: 1 }] })
      .success,
  ).toBe(false)
})

test('a shard without races moves unchanged: the list stays absent and reads as none', (): void => {
  const data = parse(QuestDataSchema, base)
  expect('races' in data).toBe(false)
  expect(data.races ?? []).toEqual([])
  expect(JSON.stringify(data)).toBe(JSON.stringify(base))
})

test('a race may name flags its finish and a lapse lower, so the next run counts them again', (): void => {
  const flags = ['gate.start', 'gate.mid', 'gate.end']
  const resets = { ...race, resets: ['gate.mid'] }
  expect(
    parse(QuestDataSchema, { ...base, flags, races: [resets] }).races,
  ).toEqual([resets])
  expect(questDataRules({ ...base, flags, races: [resets] })).toEqual([])
  expect(
    questDataRules({
      ...base,
      flags,
      races: [{ ...race, resets: ['gate.nope'] }],
    }),
  ).toContain('undeclared quest flag gate.nope')
  expect(
    questDataRules({
      ...base,
      flags,
      races: [{ ...race, resets: ['gate.start'] }],
    }),
  ).toContain('race arch-run resets its own start or stop')
  expect(
    safeParse(QuestDataSchema, {
      ...base,
      flags,
      races: [{ ...race, resets: [] }],
    }).success,
  ).toBe(false)
})

const loop = { ...base, flags: ['gate.start', 'gate.end', 'cp.a', 'cp.b'] }
const laps = {
  ...race,
  laps: 2,
  checkpoints: ['cp.a', 'cp.b'],
  ride: 'vehicle' as const,
}
const lapRowAdmits = (row: Readonly<Record<string, unknown>>): boolean =>
  safeParse(QuestDataSchema, { ...loop, races: [{ ...race, ...row }] }).success
const checkpointRules = (checkpoints: readonly string[]): string[] =>
  questDataRules({
    ...loop,
    races: [{ ...laps, checkpoints: [...checkpoints] }],
  })

test('a race may run laps over ordered checkpoints and name how it is ridden (MSZ31)', (): void => {
  expect(parse(QuestDataSchema, { ...loop, races: [laps] }).races).toEqual([
    laps,
  ])
  expect(questDataRules({ ...loop, races: [laps] })).toEqual([])
  expect(
    [0, 21, 1.5].map((count): boolean => lapRowAdmits({ laps: count })),
  ).toEqual([false, false, false])
  expect(lapRowAdmits({ checkpoints: [] })).toBe(false)
  expect(lapRowAdmits({ ride: 'board' })).toBe(false)
})

test('a race checkpoint is declared, not its own start or stop, and named once (MSZ31)', (): void => {
  expect(checkpointRules(['cp.nope'])).toContain(
    'undeclared quest flag cp.nope',
  )
  expect(checkpointRules(['cp.a', 'gate.end'])).toContain(
    'race arch-run checkpoints its own start or stop',
  )
  expect(checkpointRules(['cp.a', 'cp.a'])).toContain(
    'race arch-run names a checkpoint twice',
  )
})
