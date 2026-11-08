import assert from 'node:assert/strict'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { parse, record, string, unknown } from 'valibot'

import { readCookData } from '../format/cook-data.ts'
import { cookPreparationBytes } from '../format/cook-preparation.ts'
import { parseOutputIndex } from '../format/outputIndex.ts'
import { validationSourceBytes } from '../format/validationReceipt.ts'
import { cli, scratch, sha256, TEMPLATE_2 } from '../test/helpers/corpus.ts'

import type { CookMount } from '../format/cook-data.ts'

const dir = scratch('cook-preparation')
const ObjectSchema = record(string(), unknown())
const PROGRAMS = {
  version: 2,
  build: 'fixture-renderer',
  lines: ['void main() {}'],
  shaders: [[0]],
  programs: [[0, 0]],
} as const
function readObject(folder: string, name: string): Record<string, unknown> {
  const text = readFileSync(path.join(folder, name), 'utf8')
  return parse(ObjectSchema, JSON.parse(text))
}

function writeJson(folder: string, name: string, value: unknown): Uint8Array {
  const bytes = validationSourceBytes(value)
  mkdirSync(path.dirname(path.join(folder, name)), { recursive: true })
  writeFileSync(path.join(folder, name), bytes)
  return bytes
}
function programFixture(folder: string, slug: string): CookMount {
  const url = `/programs/${slug}.json`
  const name = `mounts${url}`
  const bytes = writeJson(folder, name, PROGRAMS)
  return { url, path: name, hash: sha256(bytes), bytes: bytes.length }
}

function candidate(name: string): string {
  const folder = path.join(dir, name)
  cpSync(TEMPLATE_2, folder, { recursive: true })
  const index = readObject(folder, 'shard.json')
  index['sdk'] = '0.3'
  writeFileSync(path.join(folder, 'shard.json'), validationSourceBytes(index))
  return folder
}

function prepared(name: string): string {
  const folder = candidate(name)
  const raw = readObject(folder, 'shard.json')
  raw['cook'] = { path: 'cook.json', hash: '0'.repeat(64), bytes: 0 }
  const index = parseOutputIndex(raw)
  const legacy = readCookData(readObject(folder, 'cook.json'))
  const mounts = [...legacy.mounts, programFixture(folder, index.identity.slug)]
  const bytes = writeJson(folder, 'cook.json', {
    version: 2,
    mounts,
    packs: 'whole',
    fence: [],
    inputHash: sha256(cookPreparationBytes(index, mounts)),
    programs: PROGRAMS,
  })
  writeJson(folder, 'shard.json', {
    ...index,
    cook: { path: 'cook.json', hash: sha256(bytes), bytes: bytes.length },
  })
  return folder
}

// The format CLI is the admission edge. New products cannot masquerade as
// prepared by omitting cook.json; immutable sdk 0.2 products stay readable.
test('new producer version refuses missing preparation with the repair command', (): void => {
  const folder = candidate('missing')
  const run = cli(['validate', folder])
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /wildshard prepare/u)
})

test('required preparation refuses stale product inputs at the pack edge', (): void => {
  const folder = candidate('stale')
  const index = readObject(folder, 'shard.json')
  const bytes = Buffer.from(
    validationSourceBytes({
      version: 2,
      mounts: [],
      packs: 'whole',
      fence: [],
      inputHash: '0'.repeat(64),
      programs: {
        version: 2,
        build: 'test-renderer',
        lines: [],
        shaders: [],
        programs: [],
      },
    }),
  )
  index['cook'] = {
    path: 'cook.json',
    hash: sha256(bytes),
    bytes: bytes.length,
  }
  writeFileSync(path.join(folder, 'cook.json'), bytes)
  writeFileSync(path.join(folder, 'shard.json'), validationSourceBytes(index))
  const run = cli(['pack', folder, '--out', path.join(dir, 'stale.tar')])
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /stale.*wildshard prepare/u)
})

test('a prepared product validates and packs; changing a bound input refuses', (): void => {
  const folder = prepared('fresh')
  assert.equal(cli(['validate', folder]).status, 0)
  assert.equal(
    cli(['pack', folder, '--out', path.join(dir, 'fresh.tar')]).status,
    0,
  )
  const raw = readObject(folder, 'shard.json')
  const index = parseOutputIndex(raw)
  writeJson(folder, 'shard.json', {
    ...index,
    build: { ...index.build, validator: 'changed-render-input' },
  })
  const run = cli(['validate', folder])
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /stale.*wildshard prepare/u)
})

test('admission refuses missing lists, duplicate hashes and hostile program indexes', (): void => {
  const folder = prepared('hostile')
  const raw = readObject(folder, 'cook.json')
  const index = parseOutputIndex(readObject(folder, 'shard.json'))
  const variants = [
    { ...raw, fence: undefined },
    { ...raw, programs: undefined },
    { ...raw, packs: undefined },
    { ...raw, fence: ['0'.repeat(64), '0'.repeat(64)] },
    {
      ...raw,
      programs: {
        version: 2,
        build: 'x',
        lines: [],
        shaders: [[0]],
        programs: [[0, 0]],
      },
    },
  ]
  for (const value of variants) {
    const bytes = writeJson(folder, 'cook.json', value)
    writeJson(folder, 'shard.json', {
      ...index,
      cook: { path: 'cook.json', hash: sha256(bytes), bytes: bytes.length },
    })
    assert.notEqual(cli(['validate', folder]).status, 0)
  }
})
