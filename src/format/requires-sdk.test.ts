import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { RequiresSchema } from './shardSections.ts'

const requires = { capabilities: [], commons: [] }

test('requires.sdk is optional: a writer that stops sourcing it still parses (CP8)', (): void => {
  expect(parse(RequiresSchema, requires).sdk).toBeUndefined()
  expect(parse(RequiresSchema, { ...requires, sdk: '0.1.0.3' }).sdk).toBe(
    '0.1.0.3',
  )
})
