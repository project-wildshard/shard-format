import assert from 'node:assert/strict'
import { test } from 'node:test'

import { corpusCounts, corpusIdentities } from './one-way-inventory.ts'

import type { SourceFile } from './one-way-source.ts'

const files: readonly SourceFile[] = [
  { path: 'corpus/handwritten/shard.json', text: '{}' },
  {
    path: 'corpus/handwritten/sections/actors/species.json',
    text: '{"rows":{"species":[{"id":"one"}],"looks":[]}}',
  },
  { path: 'corpus/exports/fixture/shard.json', text: '{}' },
  { path: 'corpus/exports/fixture/validation.json', text: '{}' },
  { path: 'src/fixture.ts', text: 'ignored' },
]

test('corpus identity covers JSON payloads, excluding validator reports and loose sources', (): void => {
  const identities = corpusIdentities(files)
  assert.equal(identities.length, 2)
  const counts = corpusCounts(files)
  assert.equal(counts['corpus.rows-without-look'], 1)
  assert.equal(counts['corpus.single-shard-server-hosts'], undefined)
  const changed = files.map((file: Readonly<SourceFile>): SourceFile => ({
    ...file,
    text: file.path.endsWith('species.json') ? '{"rows":{}}' : file.text,
  }))
  assert.notDeepEqual(corpusIdentities(changed), identities)
  assert.deepEqual(
    corpusIdentities([...files, { path: 'docs/new.md', text: 'ignored' }]),
    identities,
  )
})
