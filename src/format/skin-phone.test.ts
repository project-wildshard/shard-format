/* oxlint-disable typescript/prefer-readonly-parameter-types -- These controls deliberately corrupt decoded rows before admission. */
import { createHash } from 'node:crypto'

import { expect, test } from 'vitest'

import { fixture } from '../ci/skin-variants-fixture.ts'
import {
  resolveSkinLookFiles,
  resolveTierSkinLookFiles,
  skinLookRules,
  validateSkinAssets,
} from './skinAssets.ts'
import { tierLibrarySteps } from './tierSelection.ts'

import type { parseSkinFile } from './skinAssets.ts'

type Skin = ReturnType<typeof parseSkinFile>

/** ONE-FORMAT CC51b: a skin look's optional phone skin, the second real Brasscap bandit GLB. */
function phoneFixture(
  skin?: (value: Skin) => void,
): ReturnType<typeof fixture> {
  const sample = fixture(skin === undefined ? {} : { skin })
  delete sample.look.parameters['variants']
  sample.look.parameters['phone'] = sample.secondHash
  sample.source.library = [sample.firstHash, sample.secondHash]
  return sample
}

test('a phone skin with the same rig, clips and material admits beside its skin', (): void => {
  const sample = phoneFixture()
  expect(skinLookRules(sample.source)).toEqual([])
  validateSkinAssets(sample.source, sample.assets)
  const resolved = resolveSkinLookFiles(
    sample.source,
    sample.look,
    sample.assets,
  )
  expect(resolved.skin.hash).toBe(sample.firstHash)
  expect(resolved.phone?.hash).toBe(sample.secondHash)
  expect(resolved.phone?.row.file).not.toBe(resolved.skin.row.file)
  expect(resolved.phone?.row.rig.clips).toEqual(resolved.skin.row.rig.clips)
})

test('a phone skin outside the library or a missing phone file refuses', (): void => {
  const sample = phoneFixture()
  sample.source.library = [sample.firstHash]
  expect(skinLookRules(sample.source)).toContain('skin phone file references')
  sample.assets.delete(sample.secondHash)
  expect((): unknown =>
    resolveSkinLookFiles(sample.source, sample.look, sample.assets),
  ).toThrow('skin file missing')
})

test('a phone skin with another rig, sockets or material refuses', (): void => {
  for (const skin of [
    (value: Skin): void => {
      value.row.rig.skeleton = 'different'
    },
    (value: Skin): void => {
      value.row.rig.sockets = ['body']
    },
    (value: Skin): void => {
      value.binding.material['roughness'] = 0.123
    },
  ]) {
    const sample = phoneFixture(skin)
    expect((): void => {
      validateSkinAssets(sample.source, sample.assets)
    }).toThrow('phone skin rig or material differs')
  }
})

test('a heavier phone skin, or one skin replacing all desktop variants, refuses', (): void => {
  const heavier = phoneFixture((value): void => {
    value.row.cost.triangles += 1
  })
  expect((): unknown =>
    resolveSkinLookFiles(heavier.source, heavier.look, heavier.assets),
  ).toThrow('phone skin draws more triangles')
  const both = fixture()
  both.look.parameters['phone'] = both.secondHash
  expect((): unknown =>
    resolveSkinLookFiles(both.source, both.look, both.assets),
  ).toThrow('invalid variant table')
})

/** Keep the independent phone table explicit at its actual file hash. */
function withPhoneTable(
  sample: ReturnType<typeof fixture>,
  skins: Readonly<Record<string, string>>,
): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, skins }))
  const hash = createHash('sha256').update(bytes).digest('hex')
  sample.assets.set(hash, bytes)
  sample.source.files.push({
    hash,
    kind: 'json',
    decoded: bytes.length * 2,
    compressed: bytes.length,
    gpu: 0,
    triangles: 0,
    draws: 0,
    critical: false,
    dependencies: [...new Set(Object.values(skins))].toSorted(),
  })
  sample.source.library.push(hash)
  sample.look.parameters['phone'] = hash
  return hash
}

test('a phone variant table preserves each coat identity and chooses its own default', (): void => {
  const sample = fixture()
  withPhoneTable(sample, { plain: sample.secondHash, other: sample.firstHash })
  expect(skinLookRules(sample.source)).toEqual([])
  validateSkinAssets(sample.source, sample.assets)
  const files = resolveSkinLookFiles(sample.source, sample.look, sample.assets)
  expect(files.skin.hash).toBe(sample.firstHash)
  expect(files.variants?.get('other')?.hash).toBe(sample.secondHash)
  expect(files.phone?.hash).toBe(sample.secondHash)
  expect(files.phoneVariants?.get('other')?.hash).toBe(sample.firstHash)
})

test('runtime resolves the phone variants without the desktop table', (): void => {
  const sample = fixture()
  withPhoneTable(sample, { plain: sample.secondHash, other: sample.firstHash })
  sample.assets.delete(sample.tableHash)
  const resolved = resolveTierSkinLookFiles(sample.source, sample.look, {
    assets: sample.assets,
    tier: 'phone',
  })
  expect(resolved.skin.hash).toBe(sample.secondHash)
})

test('the phone variant table must carry every authored variant', (): void => {
  const sample = fixture()
  withPhoneTable(sample, { plain: sample.firstHash })
  expect((): unknown =>
    resolveSkinLookFiles(sample.source, sample.look, sample.assets),
  ).toThrow('variant table must name every species variant exactly')
})

test('each tier omits the other table and keeps all shared skin dependencies', (): void => {
  const sample = fixture()
  const phone = withPhoneTable(sample, {
    plain: sample.secondHash,
    other: sample.firstHash,
  })
  const source = {
    ...sample.source,
    identity: { slug: 'fixture' },
    critical: [],
  }
  const descriptor = {
    index: {
      files: source.files.map((row): { hash: string; path: string } => ({
        hash: row.hash,
        path: `blobs/${row.hash}`,
      })),
    },
    sections: new Map([['look/materials', { rows: source.rows }]]),
  }
  const excluded = (tier: 'phone' | 'desktop'): ReadonlySet<string> => {
    const steps = tierLibrarySteps(source, tier, descriptor)
    let row = steps.next()
    while (row.done !== true) {
      row = steps.next()
    }
    return row.value
  }
  expect(excluded('phone')).toEqual(new Set([sample.tableHash]))
  expect(excluded('desktop')).toEqual(new Set([phone]))
})
