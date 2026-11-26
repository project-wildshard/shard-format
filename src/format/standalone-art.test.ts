import { expect, test } from 'vitest'

import { assertStandaloneArt } from './standalone-art.ts'

const layer = '/assets/tex/leafy_grass/'
const referenced = new Map<string, unknown>([
  ['look', { ground: { url: layer } }],
])
const url = `${layer}diffuse.jpg`

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
    assertStandaloneArt(declarations, [
      { url, path: `mounts${url}`, hash: 'a'.repeat(64), bytes: 1 },
    ])
  }).not.toThrow()
})
