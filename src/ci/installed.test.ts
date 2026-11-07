import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import type { SpawnSyncReturns } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

import { object, parse, record, string } from 'valibot'

import { ROOT, scratch } from '../test/helpers/corpus.ts'

// A consumer's install, not this tree. `files` is a list of globs, so a new
// folder doesn't ship; Node won't strip types under node_modules, so a bin that
// runs here can die there. `pnpm pack` then a real, offline install finds both.
// The store already holds this repo's dependencies, so there's no network.

const dir = scratch('installed')
const ManifestSchema = object({ exports: record(string(), string()) })

function pnpm(args: readonly string[], cwd: string): SpawnSyncReturns<string> {
  const run = spawnSync('pnpm', [...args], { cwd, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr + run.stdout)
  return run
}

function install(): string {
  pnpm(['pack', '--pack-destination', dir], ROOT)
  const tarball = readdirSync(dir).find((file: string): boolean =>
    file.endsWith('.tgz'),
  )
  assert.ok(tarball !== undefined)
  const app = path.join(dir, 'app')
  mkdirSync(app)
  writeFileSync(
    path.join(app, 'package.json'),
    '{"name":"consumer","private":true,"type":"module"}\n',
  )
  // A per-run link in the shared store would outlive the test.
  writeFileSync(path.join(app, '.npmrc'), 'enable-global-virtual-store=false\n')
  pnpm(['add', '--offline', `file:${path.join(dir, tarball)}`], app)
  return app
}

const app = install()
const PACKAGE = path.join(app, 'node_modules/@wildshard/format')
const BIN = path.join(app, 'node_modules/.bin/shardfile')
const SHIPPED = path.join(PACKAGE, 'corpus/handwritten')

function installed(args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync(BIN, [...args], { cwd: app, encoding: 'utf8' })
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
  const raw = readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')
  const manifest = parse(ManifestSchema, JSON.parse(raw))
  const names = Object.entries(manifest.exports)
    .filter(([, file]: readonly [string, string]): boolean =>
      file.endsWith('.ts'),
    )
    .map(([name]: readonly [string, string]): string =>
      name.replace('.', '@wildshard/format'),
    )
  const script = path.join(app, 'imports.mjs')
  writeFileSync(
    script,
    `import { installFormatHook } from '@wildshard/format/formatHook'
installFormatHook()
for (const name of ${JSON.stringify(names)}) await import(name)
`,
  )
  const run = spawnSync(process.execPath, [script], {
    cwd: app,
    encoding: 'utf8',
  })

  assert.equal(run.status, 0, run.stderr)
})
