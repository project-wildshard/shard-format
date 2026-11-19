import { expect, test } from 'vitest'

import { parseDirectorStages } from './directorStages.ts'

test('a director observes and sets existing quest flag keys', (): void => {
  const data = parseDirectorStages({
    version: 2,
    id: 'driftwood.altar',
    inputs: { used: 'flag:used:altar' },
    stages: [
      { id: 'sealed', next: [{ when: 'used', target: 'open' }] },
      { id: 'open', do: [{ flag: { key: 'quest:shrine-set', value: true } }] },
    ],
  })
  expect(data.inputs['used']).toBe('flag:used:altar')
  expect(data.stages[1]?.do).toEqual([
    { flag: { key: 'quest:shrine-set', value: true } },
  ])
})
