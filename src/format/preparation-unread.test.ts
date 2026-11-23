import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { cookDataSpec, readCookData } from './cook-data.ts'
import { OutputIndexSchema } from './outputIndex.ts'
import { preparationMarked } from './preparation-checks.ts'
import {
  preparationSpecOf,
  unreadPreparationLine,
  unreadPreparationSpec,
} from './preparation-spec.ts'

// SHARD-COMPAT SP1b1a: a file prepared to a spec newer than this package parses with its number kept and its lists unread,
// so a cook can name it `stale preparation` (spec 5, reads 3 and 4) instead of refusing its index.

test('an index names any spec from 3 to 255; a newer one is kept and unread', (): void => {
  const spec = OutputIndexSchema.entries.preparation
  for (const value of [3, 4, 5, 255]) {
    expect(parse(spec, value)).toBe(value)
  }
  for (const value of [2, 256, 4.5, '5']) {
    expect((): unknown => parse(spec, value)).toThrow()
  }
  expect(preparationSpecOf({ preparation: 5 })).toBeUndefined()
  expect(unreadPreparationSpec({ preparation: 5 })).toBe(5)
  expect(unreadPreparationSpec({ preparation: 4 })).toBeUndefined()
  expect(unreadPreparationSpec({})).toBeUndefined()
  expect(unreadPreparationLine(5)).toBe('spec 5, reads 3 and 4')
})

test('cook.json names its spec before its rows are read', (): void => {
  expect(cookDataSpec({ version: 5, anything: 'newer' })).toBe(5)
  expect(cookDataSpec({ version: '5' })).toBeUndefined()
  expect(cookDataSpec(JSON.parse('null'))).toBeUndefined()
  expect((): unknown => readCookData({ version: 5, mounts: [] })).toThrow()
})

test('the preparation check refuses an unread spec by both numbers', (): void => {
  expect((): unknown =>
    preparationMarked({ preparation: 5 }, 5, 'wildshard prepare'),
  ).toThrow(
    'shard.json names a newer preparation (spec 5, reads 3 and 4): update this reader or run wildshard prepare',
  )
})
