import { describe, expect, it } from 'vitest'

import { packFromMembers } from './productValidation.ts'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)

describe('packFromMembers', () => {
  const files = new Map([
    ['sections/a.json', bytes('{"a":1}')],
    ['blobs/bin/b.bin', bytes('bbbb')],
  ])
  const index = {
    sections: [{ name: 'a', path: 'sections/a.json', hash: 'aa', bytes: 7 }],
    schemas: [],
    files: [{ path: 'blobs/bin/b.bin', hash: 'bb' }],
  } as unknown as Parameters<typeof packFromMembers>[1]
  const pack = {
    path: 'blobs/pack/cc.pack',
    hash: 'cc',
    bytes: 11,
    entries: [
      { hash: 'bb', offset: 0, bytes: 4 },
      { hash: 'aa', offset: 4, bytes: 7 },
    ],
  }
  const read = (path: string): Uint8Array => files.get(path) ?? new Uint8Array()

  it('lays members at their offsets', () => {
    expect(new TextDecoder().decode(packFromMembers(pack, index, read))).toBe(
      'bbbb{"a":1}',
    )
  })

  it('refuses a member nothing lists', () => {
    expect(() =>
      packFromMembers(
        { ...pack, entries: [{ hash: 'dd', offset: 0, bytes: 4 }] },
        index,
        read,
      ),
    ).toThrow('outside its listed inventory')
  })
})
