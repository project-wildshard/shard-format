import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'

import { enginePins, jsonFiles, verifyArchive } from './one-way-pins.ts'

test('archive identity checks both bytes and the full digest', (): void => {
  const bytes = new TextEncoder().encode('small archive fixture')
  const pin = {
    slug: 'fixture',
    hash: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
  }
  assert.doesNotThrow((): void => {
    verifyArchive(pin, bytes)
  })
  assert.throws((): void => {
    verifyArchive({ ...pin, bytes: pin.bytes + 1 }, bytes)
  }, /differs from the engine pin/u)
  assert.throws((): void => {
    verifyArchive({ ...pin, hash: '0'.repeat(64) }, bytes)
  }, /differs from the engine pin/u)
})

test('pin inventory refuses an absent, incomplete or repeated product set', (): void => {
  assert.throws((): void => {
    enginePins([])
  }, /lacks its product pins/u)
  assert.throws((): void => {
    enginePins([{ path: 'test/pins/shardfiles.json', text: '{"shards":[]}' }])
  }, /missing or repeats/u)
})

test('archive text inventory ignores binary files and refuses invalid JSON encoding', (): void => {
  const text = new TextEncoder().encode('{"rows":{}}')
  const binary = new Uint8Array([255])
  assert.deepEqual(
    jsonFiles(
      new Map([
        ['sections/actors/species.json', text],
        ['blobs/body.glb', binary],
      ]),
    ),
    [{ path: 'sections/actors/species.json', text: '{"rows":{}}' }],
  )
  assert.throws((): void => {
    jsonFiles(new Map([['bad.json', new Uint8Array([255])]]))
  })
})
