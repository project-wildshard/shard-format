// These controls deliberately corrupt decoded rows before admission.
/* oxlint-disable typescript/prefer-readonly-parameter-types */
import { expect, test } from 'vitest'

import { fixture } from '../ci/skin-variants-fixture.ts'
import {
  resolveSkinLookFiles,
  skinLookRules,
  validateSkinAssets,
} from './skinAssets.ts'

import type { parseSkinFile } from './skinAssets.ts'
import type { SkinVariants } from './skins.ts'

test('two real distinct skins admit with exact coverage and the old form remains valid', (): void => {
  const sample = fixture()
  expect(skinLookRules(sample.source)).toEqual([])
  validateSkinAssets(sample.source, sample.assets)
  const resolved = resolveSkinLookFiles(
    sample.source,
    sample.look,
    sample.assets,
  )
  expect(resolved.skin.hash).toBe(sample.firstHash)
  expect(resolved.variants?.get('plain')).toBe(resolved.skin)
  expect(resolved.variants?.get('other')?.hash).toBe(sample.secondHash)
  expect(resolved.variants?.get('other')?.row.file).not.toBe(
    resolved.skin.row.file,
  )
})

test('single-skin looks remain valid without a table', (): void => {
  const sample = fixture()
  delete sample.look.parameters['variants']
  expect(
    resolveSkinLookFiles(sample.source, sample.look, sample.assets).variants,
  ).toBeUndefined()
  validateSkinAssets(sample.source, sample.assets)
})

test('material property ordering preserves the shared contract', (): void => {
  const reordered = fixture({
    skin: (value): void => {
      value.binding.material = Object.fromEntries(
        Object.entries(value.binding.material).toReversed(),
      )
    },
  })
  validateSkinAssets(reordered.source, reordered.assets)
})

test('missing/unknown variants and inexact dependencies refuse', (): void => {
  for (const table of [
    (value: SkinVariants): void => {
      delete value.skins['other']
    },
    (value: SkinVariants): void => {
      value.skins['unknown'] = value.skins['other'] ?? ''
      delete value.skins['other']
    },
  ]) {
    const sample = fixture({ table })
    expect((): ReturnType<typeof resolveSkinLookFiles> =>
      resolveSkinLookFiles(sample.source, sample.look, sample.assets),
    ).toThrow('every species variant')
  }
})

test('table dependencies have exact closure', (): void => {
  for (const dependencies of [
    (values: string[]): string[] => values.slice(1),
    (values: string[]): string[] => [...values, 'f'.repeat(64)],
    (values: string[]): string[] => [...values, values[0] ?? ''],
  ]) {
    const sample = fixture({ dependencies })
    expect((): ReturnType<typeof resolveSkinLookFiles> =>
      resolveSkinLookFiles(sample.source, sample.look, sample.assets),
    ).toThrow('dependencies differ')
  }
})

test('missing skin bytes and a missing library root refuse', (): void => {
  const sample = fixture()
  sample.assets.delete(sample.secondHash)
  expect((): ReturnType<typeof resolveSkinLookFiles> =>
    resolveSkinLookFiles(sample.source, sample.look, sample.assets),
  ).toThrow('skin file missing')
  sample.source.library = [sample.firstHash]
  expect(skinLookRules(sample.source)).toContain(
    'skin variant table references',
  )
})

test('incompatible variant contracts and a table without its default refuse', (): void => {
  for (const skin of [
    (value: ReturnType<typeof parseSkinFile>): void => {
      value.row.rig.skeleton = 'different'
    },
    (value: ReturnType<typeof parseSkinFile>): void => {
      value.row.rig.sockets = ['body']
    },
    (value: ReturnType<typeof parseSkinFile>): void => {
      value.binding.material['roughness'] = 0.123
    },
  ]) {
    const sample = fixture({ skin })
    expect((): void => {
      validateSkinAssets(sample.source, sample.assets)
    }).toThrow('incompatible variant rig or material')
  }
  const sample = fixture({
    table: (value): void => {
      value.skins['plain'] = value.skins['other'] ?? ''
    },
    dependencies: (values): string[] => values.slice(1),
  })
  expect((): ReturnType<typeof resolveSkinLookFiles> =>
    resolveSkinLookFiles(sample.source, sample.look, sample.assets),
  ).toThrow('include its default skin')
})
