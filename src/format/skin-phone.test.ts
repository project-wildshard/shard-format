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

test('a phone skin drawing more triangles, or beside a variant table, refuses', (): void => {
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
  ).toThrow('a variant look has no phone skin')
})
