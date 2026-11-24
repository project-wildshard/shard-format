import { parse } from 'valibot'
import { expect, test } from 'vitest'

import { OutputIndexSchema } from './outputIndex.ts'
import { parseShardfileField } from './shardSchema.ts'
import {
  SHARDFILE_FLOOR,
  SHARDFILE_VERSION,
  SHARDFILE_VERSIONS,
  INDEX_FORMAT_VERSIONS,
  LEGACY_INDEX_VERSIONS,
  LEGACY_LAYOUT,
  shardfileFormatOf,
  outputIndexEnvelope,
  compareShardfileVersions,
  compatibleShardfileVersion,
  parseShardfileVersion,
} from './version.ts'

test('legacy format spelling equals the zero-counter revision', (): void => {
  expect(parseShardfileVersion('0.1')).toEqual([0, 1, 0, 0])
  expect(compareShardfileVersions('0.1', '0.1.0.0')).toBe(0)
  expect(compareShardfileVersions('0.1.0.10', '0.1.0.9')).toBe(1)
})

test('the real source and transport schemas admit every listed version', (): void => {
  for (const version of [SHARDFILE_VERSION, '0.1.0.1', '0.1.0.0', '0.1']) {
    expect(compatibleShardfileVersion(version)).toBe(true)
    expect(parseShardfileField('version', version)).toBe(version)
  }
})

test('CP14 (FP25): the legacy envelope names its format in version, 0.1.0.2 in formatVersion', (): void => {
  for (const version of LEGACY_INDEX_VERSIONS) {
    expect(parse(OutputIndexSchema.entries.version, version)).toBe(version)
    expect(shardfileFormatOf({ formatVersion: LEGACY_LAYOUT, version })).toBe(
      version,
    )
  }
  for (const version of INDEX_FORMAT_VERSIONS) {
    expect(parse(OutputIndexSchema.entries.formatVersion, version)).toBe(
      version,
    )
    expect((): unknown =>
      parse(OutputIndexSchema.entries.version, version),
    ).toThrow()
    expect(shardfileFormatOf({ formatVersion: version })).toBe(version)
  }
  expect((): unknown => shardfileFormatOf({ formatVersion: 2 })).toThrow()
})

test('CP14: a writer passes legacy rows through outputIndexEnvelope and gets the envelope its version spells', (): void => {
  const legacy = {
    format: 'wildshard.shardfile',
    formatVersion: LEGACY_LAYOUT,
    schemas: [],
    requires: { sdk: '0.1.0.2', capabilities: [], commons: [] },
    runtime: { kind: 'client-plan', files: [], lines: 0, binds: [] },
  }
  expect(outputIndexEnvelope({ ...legacy, version: '0.1.0.1' })).toEqual({
    ...legacy,
    version: '0.1.0.1',
  })
  expect(outputIndexEnvelope({ ...legacy, version: '0.1.0.2' })).toEqual({
    format: 'wildshard.shardfile',
    formatVersion: '0.1.0.2',
    requires: { sdk: '0.1.0.2', capabilities: [], commons: [] },
    runtime: { kind: 'client-plan', binds: [] },
  })
  // PR4: from 0.1.0.3 the sdk marker goes; a prepared '0.3' becomes preparation spec 3 unless the writer names one.
  const built = outputIndexEnvelope({
    ...legacy,
    sdk: '0.2',
    version: '0.1.0.3',
  })
  expect(Object.hasOwn(built, 'sdk')).toBe(false)
  expect(Object.hasOwn(built, 'preparation')).toBe(false)
  expect(
    outputIndexEnvelope({ ...legacy, sdk: '0.3', version: '0.1.0.3' })
      .preparation,
  ).toBe(3)
  expect(
    outputIndexEnvelope({
      ...legacy,
      sdk: '0.3',
      preparation: 4,
      version: '0.1.0.3',
    }).preparation,
  ).toBe(4)
  // FP33: from 0.1.0.5 requires carries no sdk.
  expect(
    outputIndexEnvelope({ ...legacy, version: '0.1.0.4' }).requires,
  ).toEqual({ sdk: '0.1.0.2', capabilities: [], commons: [] })
  expect(
    outputIndexEnvelope({ ...legacy, version: '0.1.0.5' }).requires,
  ).toEqual({ capabilities: [], commons: [] })
})

test('the additive window never reaches a newer or breaking format', (): void => {
  expect(compatibleShardfileVersion('0.1.0.1', '0.1')).toBe(false)
  expect(compatibleShardfileVersion('0.1.0.1', '0.1.0.2')).toBe(true)
  expect(compatibleShardfileVersion('0.1.0.2', '0.1.0.3')).toBe(true)
  expect(compatibleShardfileVersion('0.1.0.3', '0.1.0.4')).toBe(true)
  for (const version of ['0.1.0.7', '0.1.1.0', '0.2', '1.1.0.1', '0.0']) {
    expect(compatibleShardfileVersion(version)).toBe(false)
    expect((): unknown => parseShardfileField('version', version)).toThrow()
    expect((): unknown =>
      parse(OutputIndexSchema.entries.version, version),
    ).toThrow()
    expect((): unknown =>
      parse(OutputIndexSchema.entries.formatVersion, version),
    ).toThrow()
  }
})

test('a reader admits every older additive counter down to the floor (J486)', (): void => {
  for (const version of SHARDFILE_VERSIONS) {
    expect(compatibleShardfileVersion(version)).toBe(true)
  }
  expect(compatibleShardfileVersion('0.1', '0.1.0.2')).toBe(true)
  expect(compatibleShardfileVersion('0.1.0.0', '0.1.0.9')).toBe(true)
  expect(compatibleShardfileVersion(SHARDFILE_FLOOR, '0.1.0.30')).toBe(true)
  expect(compatibleShardfileVersion('0.1.0.3', '0.1.0.2')).toBe(false)
  expect(compatibleShardfileVersion('0.0', '0.1.0.2')).toBe(false)
  expect(compatibleShardfileVersion('0.1.0.1', '0.1.1.0')).toBe(false)
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
