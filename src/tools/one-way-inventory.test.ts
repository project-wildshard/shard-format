import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import {
  corpusCounts,
  corpusIdentities,
  migratedCorpus,
} from './one-way-inventory.ts'
import { workingFiles } from './one-way-source.ts'

import type { SourceFile } from './one-way-source.ts'

const files: readonly SourceFile[] = [
  { path: 'corpus/exports/second/shard.json', text: '{}' },
  {
    path: 'corpus/exports/second/sections/actors/species.json',
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

/** A product the chain cannot admit (no inventory), written under a scratch format root. */
const BROKEN: readonly SourceFile[] = [
  { path: 'corpus/exports/broken/shard.json', text: '{}' },
  {
    path: 'corpus/exports/broken/sections/ui/level.json',
    text: '{"manifest":{"sky":{},"spawn":{}}}',
  },
]
async function brokenRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'fp47c-'))
  await mkdir(path.join(root, 'corpus/exports/broken/sections/ui'), {
    recursive: true,
  })
  await Promise.all(
    BROKEN.map(async (file: Readonly<SourceFile>): Promise<void> => {
      await writeFile(path.join(root, file.path), file.text)
    }),
  )
  return root
}

test('FP47c: a corpus product the chain cannot admit counts as stored', async (): Promise<void> => {
  const root = await brokenRoot()
  try {
    const copy = await migratedCorpus(root, BROKEN)
    assert.deepEqual(copy, BROKEN)
    assert.equal(corpusCounts(copy)['corpus.repeated-manifest-fields'], 2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('FP47c: the real corpus counts as the chain serves it', async (): Promise<void> => {
  // ZONE-SNAPSHOTS ZS5 (J507): the stored SS3 copy (nine repeated words as stored) is gone; the chain serves none.
  const real = await workingFiles(process.cwd())
  const served = corpusCounts(await migratedCorpus(process.cwd(), real))
  assert.equal(served['corpus.repeated-manifest-fields'], 0)
})
