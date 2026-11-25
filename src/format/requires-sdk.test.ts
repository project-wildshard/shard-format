import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { RequiresSchema } from './shardSections.ts'

const requires = { capabilities: [], commons: [] }

// FORMAT-PRUNE FP33: `requires.sdk` (a copy of the format version nothing read) is deleted at zero live users; an older
// original that still carries it reads only through the chain (`fp33-drop-requires-sdk`).
test('requires.sdk is gone: the schema refuses it', (): void => {
  expect(parse(RequiresSchema, requires)).not.toHaveProperty('sdk')
  expect((): unknown =>
    parse(RequiresSchema, { ...requires, sdk: '0.1.0.3' }),
  ).toThrow()
})
