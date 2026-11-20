// ONE-FORMAT OF22c3: a chapter's wake names a declared boss fight, so `quest.chapter` needs no `population` (the retired
// mixed population). A writer that still sends it is admitted as before.
import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { NativeAssemblySchema } from './nativeAssembly.ts'

const chapter = {
  host: 'quest.chapter',
  id: 'chapter',
  rows: { file: 'quests/chapter.json' },
  wake: { file: 'quests/wake.json' },
  reward: 'reward',
}
const plan = (feature: object): object => ({
  kind: 'native-assembly',
  level: { speed: 1, ground: { size: 1, height: 0 } },
  terrain: { kind: 'flat' },
  navigation: 'shard',
  entries: {},
  features: [feature],
})

test('a quest.chapter row needs no population', (): void => {
  expect(safeParse(NativeAssemblySchema, plan(chapter)).success).toBe(true)
})

test('a quest.chapter row that still names its population is admitted', (): void => {
  expect(
    safeParse(
      NativeAssemblySchema,
      plan({ ...chapter, population: 'driftwood.island' }),
    ).success,
  ).toBe(true)
})
