import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { readTar } from '../format/tar.ts'
import {
  ROOT,
  TEMPLATE_2,
  cli,
  scratch,
  sha256,
} from '../test/helpers/corpus.ts'

// J168: Template 2 is a folder of JSON and baked files, and the format needs
// nothing else to take it to a tarball a host accepts. The bytes aren't pinned
// here: an edit to Template 2 should be free. Only the path is.

const dir = scratch('template-2')
const UI = 'sections/ui/ui.json'
const EDITED = 'Open or close the door'
const CODE = /\.(?:ts|tsx|js|mjs|cjs|py)$/u
const OTHER_REPOS = /@wildshard\/(?:sharddev|engine)|\bthree@/u
const SOURCE_HASH = /source (?<hash>[\da-f]{64})$/mu
const TIME = 1_000_000_000

function pack(folder: string, name: string): string {
  const out = path.join(dir, `${name}.tar`)
  const run = cli(['pack', folder, '--out', out])
  assert.equal(run.stderr, '')
  assert.equal(run.status, 0)
  return out
}

function copy(name: string): string {
  const folder = path.join(dir, name)
  cpSync(TEMPLATE_2, folder, { recursive: true })
  return folder
}

function sourceOf(target: string): string {
  const run = cli(['validate', target])
  assert.equal(run.stderr, '')
  assert.equal(run.status, 0)
  return SOURCE_HASH.exec(run.stdout)?.groups?.['hash'] ?? ''
}

test('the folder is data, and this repo needs no other', (): void => {
  const code = readdirSync(TEMPLATE_2, {
    recursive: true,
    encoding: 'utf8',
  }).filter((file: string): boolean => CODE.test(file))
  const lock = readFileSync(path.join(ROOT, 'pnpm-lock.yaml'), 'utf8')

  assert.deepEqual(code, [])
  assert.doesNotMatch(lock, OTHER_REPOS)
  sourceOf(TEMPLATE_2)
})

test('a tarball is the same bytes, whatever the folder went through', (): void => {
  const first = pack(TEMPLATE_2, 'first')
  const moved = copy('moved')
  for (const file of readdirSync(moved, {
    recursive: true,
    encoding: 'utf8',
  })) {
    const full = path.join(moved, file)
    if (statSync(full).isFile()) {
      utimesSync(full, TIME, TIME)
    }
  }
  const second = pack(moved, 'second')

  assert.equal(sha256(readFileSync(second)), sha256(readFileSync(first)))
  assert.equal(sourceOf(first), sourceOf(TEMPLATE_2))
})

test('a system tar reads a pack, and that folder is the shard', (): void => {
  const tar = pack(TEMPLATE_2, 'for-tar')
  const unpacked = path.join(dir, 'unpacked')
  mkdirSync(unpacked)
  const read = spawnSync('tar', ['-xf', tar, '-C', unpacked], {
    encoding: 'utf8',
  })

  assert.equal(read.status, 0)
  assert.equal(sourceOf(unpacked), sourceOf(TEMPLATE_2))
})

/** Rewrites the UI section by hand, in a layout format would never write. */
function editUi(folder: string): void {
  const section = path.join(folder, UI)
  const before = readFileSync(section, 'utf8')
  const after = before.replace('Open / close door', EDITED)
  assert.notEqual(after, before)
  writeFileSync(section, `${JSON.stringify(JSON.parse(after), undefined, 2)}\n`)
}

test('a hand edit, in any layout, follows through to the tarball', (): void => {
  const edited = copy('edited')
  editUi(edited)

  assert.equal(cli(['validate', edited]).status, 3, 'the folder is stale')
  const tar = pack(edited, 'edited')
  const held = readTar(readFileSync(tar)).get(UI) ?? new Uint8Array()

  assert.ok(new TextDecoder().decode(held).includes(EDITED))
  assert.notEqual(sourceOf(tar), sourceOf(TEMPLATE_2))
})

test('pack writes nothing for a folder that fails', (): void => {
  const broken = copy('broken')
  writeFileSync(path.join(broken, UI), '{"targets":"not rows"}\n')
  const out = path.join(dir, 'broken.tar')
  const run = cli(['pack', broken, '--out', out])

  assert.equal(run.status, 3)
  assert.throws((): void => {
    statSync(out)
  })
})
