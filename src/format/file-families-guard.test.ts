import { expect, test } from 'vitest'

import { PLATFORM_FILE_FAMILIES } from './platformFileFamilies.ts'

// FORMAT-PRUNE FP28 (G1004): about ten file families are exact documents of one shard (quests/trader, mill-door and
// lanterns, directors/main, the weather files, world/dressing-pages/0, the island plans, people/cards,
// world/building-life). Each stays until its shard moves (OF22e, OF23, OF24), then goes at zero users through FE7.
// No new one-user family: the count only falls. A family a second shard needs raises it in the same commit, naming
// both users.
const FAMILIES_AT_MOST = 94

test('FP28: no new file family without a second user; the count only falls', (): void => {
  expect(PLATFORM_FILE_FAMILIES.length).toBeLessThanOrEqual(FAMILIES_AT_MOST)
})
