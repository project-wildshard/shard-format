import { expect, test } from 'vitest'

import { assertStandaloneArt } from './standalone-art.ts'

import type { CookMount } from './cook-data.ts'

const layer = '/assets/tex/leafy_grass/'
const referenced = new Map<string, unknown>([
  ['look', { ground: { url: layer } }],
])
const url = `${layer}diffuse.jpg`

function mount(url: string): CookMount {
  return { url, path: `mounts${url}`, hash: 'a'.repeat(64), bytes: 1 }
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
