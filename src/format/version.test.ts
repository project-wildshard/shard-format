import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { OutputIndexSchema } from './outputIndex.ts'
import { parseShardfileField } from './shardSchema.ts'
import {
  SHARDFILE_VERSION,
  compareShardfileVersions,
  compatibleShardfileVersion,
  parseShardfileVersion,
} from './version.ts'

test('legacy format spelling equals the zero-counter revision', (): void => {
  expect(parseShardfileVersion('0.1')).toEqual([0, 1, 0, 0])
  expect(compareShardfileVersions('0.1', '0.1.0.0')).toBe(0)
  expect(compareShardfileVersions('0.1.0.10', '0.1.0.9')).toBe(1)
})

test('the real source and transport schemas admit N and N-1', (): void => {
  for (const version of [SHARDFILE_VERSION, '0.1.0.0', '0.1']) {
    expect(compatibleShardfileVersion(version)).toBe(true)
    expect(parseShardfileField('version', version)).toBe(version)
    expect(parse(OutputIndexSchema.entries.version, version)).toBe(version)
  }
})

test('the additive window never reaches a newer or breaking format', (): void => {
  expect(compatibleShardfileVersion('0.1.0.1', '0.1')).toBe(false)
  expect(compatibleShardfileVersion('0.1.0.0', '0.1.0.2')).toBe(false)
  expect(compatibleShardfileVersion('0.1.0.1', '0.1.0.2')).toBe(true)
  for (const version of ['0.1.0.2', '0.1.1.0', '0.2', '1.1.0.1', '0.0']) {
    expect(compatibleShardfileVersion(version)).toBe(false)
    expect((): unknown => parseShardfileField('version', version)).toThrow()
    expect((): unknown =>
      parse(OutputIndexSchema.entries.version, version),
    ).toThrow()
  }
})

test('malformed and unbounded components never enter the format window', (): void => {
  for (const value of [
    1,
    false,
    '0.1.0',
    '0.01',
    '0.1.0.01',
    '0.1.0.-1',
    '0.1.0.10000',
    '0.1.0.1-dev',
    '0.1\n',
  ]) {
    expect((): unknown => parseShardfileVersion(value)).toThrow()
    expect(compatibleShardfileVersion(value)).toBe(false)
  }
})
