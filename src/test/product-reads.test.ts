import assert from 'node:assert/strict'
import { test } from 'node:test'

import { packFromMembers } from '../format/product-reads.ts'

const utf8 = new TextEncoder()
const files = new Map([
  ['sections/a.json', utf8.encode('{"a":1}')],
  ['blobs/bin/b.bin', utf8.encode('bbbb')],
])
const index = {
  sections: [{ hash: 'aa', path: 'sections/a.json' }],
  schemas: [],
  files: [{ hash: 'bb', path: 'blobs/bin/b.bin' }],
}
const pack = {
  path: 'blobs/pack/cc.pack',
  hash: 'cc',
  bytes: 11,
  entries: [
    { hash: 'bb', offset: 0, bytes: 4 },
    { hash: 'aa', offset: 4, bytes: 7 },
  ],
}

function read(path: string): Uint8Array {
  return files.get(path) ?? new Uint8Array()
}

test('a pack comes back from its members, at their offsets', (): void => {
  const bytes = packFromMembers(pack, index, read)
  assert.equal(new TextDecoder().decode(bytes), 'bbbb{"a":1}')
})

test('a member nothing lists is refused', (): void => {
  const entries = [{ hash: 'dd', offset: 0, bytes: 4 }]
  assert.throws(
    (): unknown => packFromMembers({ ...pack, entries }, index, read),
    /outside its listed inventory/u,
  )
})
