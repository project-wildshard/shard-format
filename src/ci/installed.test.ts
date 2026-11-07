import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { object, parse, record, string } from 'valibot'

import { ROOT, scratch } from '../test/helpers/corpus.ts'

// A consumer's install, not this tree. `files` is a list of globs, so a new
// folder doesn't ship; Node won't strip types under node_modules, so a bin that
// runs here can die there. So: `pnpm pack`'s tarball, unpacked where an install
// puts it, beside only what it declares. pnpm doesn't do the install, because
// that needs the registry's metadata, and tests have no network.

const dir = scratch('installed')
const ManifestSchema = object({
  bin: record(string(), string()),
  dependencies: record(string(), string()),
  exports: record(string(), string()),
})

function shell(command: string, args: readonly string[]): void {
  const run = spawnSync(command, [...args], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr + run.stdout)
}

function packToDir(): string {
  shell('pnpm', ['pack', '--pack-destination', dir])
  const tarball = readdirSync(dir).find((file: string): boolean =>
    file.endsWith('.tgz'),
  )
  assert.ok(tarball !== undefined)
  return path.join(dir, tarball)
}

function install(): string {
  const unpacked = path.join(dir, 'app/node_modules/@wildshard/format')
  mkdirSync(unpacked, { recursive: true })
  shell('tar', ['-xzf', packToDir(), '-C', unpacked, '--strip-components', '1'])
  return unpacked
}

const PACKAGE = install()
const APP = path.join(dir, 'app')
const SHIPPED = path.join(PACKAGE, 'corpus/handwritten')
const raw = readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')
const manifest = parse(ManifestSchema, JSON.parse(raw))
const BIN = path.join(PACKAGE, manifest.bin['shardfile'] ?? 'no bin')
for (const name of Object.keys(manifest.dependencies)) {
  symlinkSync(
    path.join(ROOT, 'node_modules', name),
    path.join(APP, 'node_modules', name),
  )
}

function installed(args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd: APP,
    encoding: 'utf8',
  })
}

test('the installed bin validates and packs the shipped Template 2', (): void => {
  const tar = path.join(dir, 'installed.tar')

  const checked = installed(['validate', SHIPPED])
  assert.equal(checked.status, 0, checked.stderr)
  const packed = installed(['pack', SHIPPED, '--out', tar])
  assert.equal(packed.status, 0, packed.stderr)
  assert.equal(installed(['validate', tar]).status, 0)
})

test('every subpath a consumer can name loads', (): void => {
  const names = Object.entries(manifest.exports)
    .filter(([, file]: readonly [string, string]): boolean =>
      file.endsWith('.ts'),
    )
    .map(([name]: readonly [string, string]): string =>
      name.replace('.', '@wildshard/format'),
    )
  const script = path.join(APP, 'imports.mjs')
  writeFileSync(
    script,
    `import { installFormatHook } from '@wildshard/format/formatHook'
installFormatHook()
for (const name of ${JSON.stringify(names)}) await import(name)
`,
  )
  const run = spawnSync(process.execPath, [script], {
    cwd: APP,
    encoding: 'utf8',
  })

  assert.equal(run.status, 0, run.stderr)
})
