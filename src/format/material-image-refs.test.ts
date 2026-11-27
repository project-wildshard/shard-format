import { expect, test } from 'vitest'

import { isTextureKind } from './texture-kind.ts'

// SF16/SF17 (J525): a look material's map named by hash may be a PNG or JPEG image the cook encodes (Dunes' sand maps),
// as SF16 made the material graph, prop and splat slots; any other kind still refuses (shardSchema's library closure rule).
test('a texture named by hash is a KTX2 or an image, never another kind', (): void => {
  expect(isTextureKind('ktx2')).toBe(true)
  expect(isTextureKind('image')).toBe(true)
  for (const kind of ['glb', 'bin', 'json', undefined]) {
    expect(isTextureKind(kind)).toBe(false)
  }
})
