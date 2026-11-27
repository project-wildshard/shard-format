import { deepEqual, equal } from 'node:assert/strict'

import { parse, safeParse } from 'valibot'
import { test } from 'vitest'

import { GraphArmsSchema } from './graphArmsRows.ts'

const { maps } = GraphArmsSchema.entries
const base = {
  base: '/assets/nine-dragon/rig/',
  names: ['glove'],
  kinds: { maps: 'uMapsTex', nrm: 'uNrmTex' },
  anisotropy: 4,
}

test('held map rows keep the WebP default and can name PNG maps', (): void => {
  deepEqual(parse(maps, base), base)
  const png = { ...base, imageExtension: 'png' }
  deepEqual(parse(maps, png), png)
  equal(safeParse(maps, { ...base, imageExtension: 'ktx2' }).success, false)
})
