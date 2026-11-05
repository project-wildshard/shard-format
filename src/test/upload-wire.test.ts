import assert from 'node:assert/strict'
import { test } from 'node:test'

import { is, parse } from 'valibot'

import {
  DirectUploadTicketSchema,
  ShardSlugSchema,
  ShardfileHashSchema,
  UploadResultSchema,
} from '../format/upload-wire.ts'

test('a hash is 64 lowercase hex digits', (): void => {
  assert.equal(is(ShardfileHashSchema, 'a'.repeat(64)), true)
  assert.equal(is(ShardfileHashSchema, 'A'.repeat(64)), false)
  assert.equal(is(ShardfileHashSchema, 'a'.repeat(63)), false)
})

test('a slug is what identity.slug admits', (): void => {
  assert.equal(is(ShardSlugSchema, 'driftwood-isle'), true)
  assert.equal(is(ShardSlugSchema, '_template'), false)
})

test('a ticket says stored or names the exact PUT', (): void => {
  const put = {
    stored: false,
    method: 'PUT',
    url: 'https://r2.example/x',
    headers: { 'content-length': '1' },
    expiresAt: '2026-11-05T00:00:00.000Z',
  }

  assert.deepEqual(parse(DirectUploadTicketSchema, { stored: true }), {
    stored: true,
  })
  assert.deepEqual(parse(DirectUploadTicketSchema, put), put)
  assert.equal(is(DirectUploadTicketSchema, { stored: false }), false)
})

test('an upload result must carry the revision', (): void => {
  assert.equal(is(UploadResultSchema, { hash: 'a'.repeat(64) }), false)
})
