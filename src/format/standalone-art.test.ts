import { expect, test } from 'vitest'

import { assertStandaloneArt } from './standalone-art.ts'

import type { CookMount } from './cook-data.ts'

const layer = '/assets/tex/leafy_grass/'
const referenced = new Map<string, unknown>([
  ['look', { ground: { url: layer } }],
])
const url = `${layer}diffuse.jpg`

function mount(assetUrl: string): CookMount {
  return {
    url: assetUrl,
    path: `mounts${assetUrl}`,
    hash: 'a'.repeat(64),
    bytes: 1,
  }
}

test('a ground layer named outside of the shardfile is refused', (): void => {
  expect((): void => {
    assertStandaloneArt(referenced.values(), [])
  }).toThrow(layer)
})

test('the carried ground layer and engine-owned art are allowed', (): void => {
  const declarations = [
    ...referenced.values(),
    { url: '/assets/baked/common/cloud-field.bin?v=5' },
  ]
  expect((): void => {
    assertStandaloneArt(declarations, [mount(url)])
  }).not.toThrow()
})

test('placed zones can name a ground folder without a trailing slash', (): void => {
  const folder = '/assets/example/tex/leafy_grass'
  expect((): void => {
    assertStandaloneArt(
      [{ groundLayers: [folder] }],
      [mount(`${folder}/albedo.jpg`)],
    )
  }).not.toThrow()
  expect((): void => {
    assertStandaloneArt(
      [{ groundLayers: [folder] }],
      [mount(`${folder}_other/albedo.jpg`)],
    )
  }).toThrow(folder)
})

test('a sky stem admits its HDR or complete gain pair', (): void => {
  const sky = '/assets/example/hdri/cloudy'
  const look = [{ hdri: sky }]
  const colour = mount(`${sky}_2k.sky.jpg`)
  expect((): void => {
    assertStandaloneArt(look, [mount(`${sky}_2k.hdr`)])
  }).not.toThrow()
  expect((): void => {
    assertStandaloneArt(look, [colour, mount(`${sky}_2k.gain.png`)])
  }).not.toThrow()
  expect((): void => {
    assertStandaloneArt(look, [colour])
  }).toThrow(sky)
})

test('the engine-built physics binary is engine art', (): void => {
  // A shard's boot rows name it (sharddev sharedBootPhysics); Pine Hollow's build with an authored shardVersion refused it.
  expect((): void => {
    assertStandaloneArt([{ physics: ['/assets/physics/rapier.wasm'] }], [])
  }).not.toThrow()
})

test('a URL template is covered by a mounted file it names', (): void => {
  // A keyed sky names its files as `{id}` templates (Pine Hollow's look keyFiles).
  const keyFiles = {
    color: '/assets/example/hdri/{id}_2k.key.jpg',
    gain: '/assets/example/hdri/{id}_2k.key.gain.png',
  }
  const mounts = [
    mount('/assets/example/hdri/dusk_2k.key.jpg'),
    mount('/assets/example/hdri/dusk_2k.key.gain.png'),
  ]
  expect((): void => {
    assertStandaloneArt([{ keyFiles }], mounts)
  }).not.toThrow()
  expect((): void => {
    assertStandaloneArt([{ keyFiles }], mounts.slice(0, 1))
  }).toThrow(keyFiles.gain)
  expect((): void => {
    assertStandaloneArt(
      [{ keyFiles }],
      [mount('/assets/example/hdri/a/b_2k.key.jpg')],
    )
  }).toThrow('{id}')
})
