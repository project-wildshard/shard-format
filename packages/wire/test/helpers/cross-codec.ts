/* oxlint-disable typescript/no-unsafe-type-assertion, import/no-namespace, import/max-dependencies, import/no-nodejs-modules, node/no-process-env -- the harness loads two codecs whole (a released one from git, typed as HEAD's, which is what it proves) and reads WIRE_CROSS_REF */
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, stat } from 'node:fs/promises'
import { text as readAll } from 'node:stream/consumers'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as classTables from '../../src/class-tables.ts'
import * as classes from '../../src/classes.ts'
import * as columns from '../../src/columns.ts'
import * as eventStream from '../../src/event-stream.ts'
import * as frameRecord from '../../src/frame-record.ts'
import * as framing from '../../src/framing.ts'
import * as game from '../../src/game.ts'
import * as handshake from '../../src/handshake.ts'
import * as projection from '../../src/projection.ts'
import * as rideTables from '../../src/ride-tables.ts'
import * as spawnColumns from '../../src/spawn-columns.ts'

// WR6 (7): a codec, HEAD's or a released one. The released codec is that
// ref's compiled lib, extracted beside HEAD under node_modules (Node strips
// no types there, so the committed JS is what runs) and cached by commit.

/** The codec modules the cross-version session uses. */
interface Codec {
  readonly name: string
  readonly classTables: typeof classTables
  readonly classes: typeof classes
  readonly columns: typeof columns
  readonly eventStream: typeof eventStream
  readonly frameRecord: typeof frameRecord
  readonly framing: typeof framing
  readonly game: typeof game
  readonly handshake: typeof handshake
  readonly projection: typeof projection
  readonly rideTables: typeof rideTables
  readonly spawnColumns: typeof spawnColumns
}

/** The repo root: git archive from a subdirectory sees only that subdirectory. */
const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const CACHE = new URL('../../node_modules/.wire-cross/', import.meta.url)
/** The scratch ref until `wire-v1.0.0` exists (the plan's 7): WR4's last codec commit. */
const SCRATCH = '669d1fc'
const OK = 0
const FIRST = 0

const HEAD: Codec = {
  name: 'HEAD',
  classTables,
  classes,
  columns,
  eventStream,
  frameRecord,
  framing,
  game,
  handshake,
  projection,
  rideTables,
  spawnColumns,
}

/** Run a command in the repo; its stdout, trimmed, or undefined when it fails. */
async function run(
  command: string,
  args: readonly string[],
): Promise<string | undefined> {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const [stdout, closed] = await Promise.all([
    readAll(child.stdout),
    once(child, 'close'),
  ])
  return closed.at(FIRST) === OK ? stdout.trim() : undefined
}

/** The ref to hold HEAD to: WIRE_CROSS_REF, the last minor release reachable from HEAD, or the scratch ref. */
async function releasedRef(): Promise<string> {
  const env = process.env['WIRE_CROSS_REF']
  const tag = await run('git', [
    'describe',
    '--tags',
    '--abbrev=0',
    '--match',
    'wire-v*.*.0',
    'HEAD',
  ])
  return env ?? tag ?? SCRATCH
}

/** Extract `ref`'s compiled lib once; the directory it went to. */
async function extract(ref: string): Promise<URL> {
  const sha = await run('git', ['rev-parse', '--short=12', ref])
  if (sha === undefined) {
    throw new Error(`No such ref ${ref}`)
  }
  const into = new URL(`${sha}/`, CACHE)
  const done = await stat(new URL('lib/src/game.js', into)).then(
    (): boolean => true,
    (): boolean => false,
  )
  if (!done) {
    await mkdir(new URL('lib/', into), { recursive: true })
    const archive = `git archive ${sha}:packages/wire/lib | tar -x -C '${fileURLToPath(new URL('lib/', into))}'`
    await run('sh', ['-c', archive])
  }
  return into
}

/** One released module, typed as HEAD's. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a URL is the platform's own class
async function released<Module>(into: URL, file: string): Promise<Module> {
  return (await import(
    pathToFileURL(fileURLToPath(new URL(`lib/src/${file}.js`, into))).href
  )) as Module
}

/** The released codec at `ref`. */
async function releasedCodec(ref: string): Promise<Codec> {
  const into = await extract(ref)
  const load = async <Module>(file: string): Promise<Module> =>
    await released<Module>(into, file)
  return {
    name: ref,
    classTables: await load<typeof classTables>('class-tables'),
    classes: await load<typeof classes>('classes'),
    columns: await load<typeof columns>('columns'),
    eventStream: await load<typeof eventStream>('event-stream'),
    frameRecord: await load<typeof frameRecord>('frame-record'),
    framing: await load<typeof framing>('framing'),
    game: await load<typeof game>('game'),
    handshake: await load<typeof handshake>('handshake'),
    projection: await load<typeof projection>('projection'),
    rideTables: await load<typeof rideTables>('ride-tables'),
    spawnColumns: await load<typeof spawnColumns>('spawn-columns'),
  }
}

export { HEAD, releasedCodec, releasedRef, type Codec }
