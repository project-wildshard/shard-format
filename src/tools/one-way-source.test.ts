import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import { promisify } from 'node:util'

import { scratchDir } from '../../scripts/scratch-dir.mjs'
import { revisionFiles, workingFiles } from './one-way-source.ts'

import type { SourceFile } from './one-way-source.ts'

// eslint-disable-next-line typescript/strict-void-return -- Node execFile returns a child while its callback supplies the result.
const execute = promisify(execFile)
const lane = process.env['WS_LANE_NAME'] ?? 'one-format-tests'
const scratch = scratchDir(lane, 'Pinned inventory test fixtures', {
  env: { ...process.env, WS_LANE_NAME: lane },
})
const owned: string[] = []

afterEach(async (): Promise<void> => {
  await Promise.all(
    owned.splice(0).map(async (folder: string): Promise<void> => {
      await rm(folder, { recursive: true, force: true })
    }),
  )
})

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(scratch, 'sources-'))
  owned.push(root)
  await mkdir(path.join(root, 'src'), { recursive: true })
  await mkdir(path.join(root, 'docs'), { recursive: true })
  await mkdir(path.join(root, 'corpus'), { recursive: true })
  await Promise.all([
    writeFile(path.join(root, 'src/a.ts'), 'export const label = "wolf"\n'),
    writeFile(path.join(root, 'src/b.ts'), 'export const label = "wolf"\n'),
    writeFile(path.join(root, 'docs/guide.md'), 'One shard format.\n'),
    writeFile(path.join(root, 'README.md'), 'Fixture.\n'),
    writeFile(path.join(root, 'corpus/species.json'), '{"species":[]}'),
  ])
  return root
}

async function pin(root: string): Promise<string> {
  await execute('git', ['init', '--quiet', root])
  await execute('git', [
    '-C',
    root,
    'add',
    'src/a.ts',
    'src/b.ts',
    'docs/guide.md',
    'README.md',
  ])
  await execute('git', [
    '-C',
    root,
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'test: pin fixture',
    '--',
    'src/a.ts',
    'src/b.ts',
    'docs/guide.md',
    'README.md',
  ])
  const result = await execute('git', ['-C', root, 'rev-parse', 'HEAD'])
  return result.stdout.trim()
}

test('reads a pinned revision, including duplicate blobs, without loose edits', async (): Promise<void> => {
  const root = await fixture()
  const revision = await pin(root)
  await writeFile(path.join(root, 'src/a.ts'), 'changed after the pin\n')
  const files = await revisionFiles(root, revision)
  assert.equal(files.length, 4)
  assert.equal(
    files.find((row: Readonly<SourceFile>): boolean => row.path === 'src/a.ts')
      ?.text,
    'export const label = "wolf"\n',
  )
  assert.equal(
    files.find((row: Readonly<SourceFile>): boolean => row.path === 'src/b.ts')
      ?.text,
    'export const label = "wolf"\n',
  )
  await assert.rejects(revisionFiles(root, 'main'), /full commit/u)
})

test('reads current format sources and corpus while ignoring build output', async (): Promise<void> => {
  const root = await fixture()
  await mkdir(path.join(root, 'out'), { recursive: true })
  await writeFile(path.join(root, 'out/ignored.ts'), 'ignored\n')
  const files = await workingFiles(root)
  const paths = files.map((row: Readonly<SourceFile>): string => row.path)
  assert.deepEqual(
    paths,
    [
      'corpus/species.json',
      'docs/guide.md',
      'README.md',
      'src/a.ts',
      'src/b.ts',
    ].toSorted((left: string, right: string): number =>
      left.localeCompare(right),
    ),
  )
})
