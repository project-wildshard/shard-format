import { loadCandidate } from './corpus-candidate.ts'
import { corpusGate } from './corpus-gate.ts'
import {
  classifyKept,
  keptLines,
  liveHashes,
  pointedHashes,
} from './corpus-live.ts'
import { readPins } from './corpus-pins.ts'
import { corpusReport } from './corpus-report.ts'
import { corpusUsage, writeUsage } from './corpus-usage.ts'
import { listKept, runCorpus } from './corpus.ts'
import { readVersion } from './version.ts'

import type { Pin } from './corpus-pins.ts'
import type { CorpusRow, StoredRecord } from './corpus.ts'

interface CorpusArgs {
  readonly api: string
  readonly cache: string
  readonly usage: string | undefined
  readonly pins: string | undefined
  readonly candidate: string | undefined
  readonly only: string | undefined
  /** ZS3: store drift blocks too (corpus.yml's nightly once ZS11 finalizes the retired and proof shards). */
  readonly strictStore?: boolean
}

const EXIT_OK = 0
const EXIT_INVALID = 3
const NONE = 0
const ENGINE_PINS =
  'https://raw.githubusercontent.com/project-wildshard/engine/main/test/pins'
/** ZS3 (J507): the next releases, production's and staging's, as engine pins them. */
const LIVE_PINS = `${ENGINE_PINS}/shardfiles.json,${ENGINE_PINS}/staging.json`
/** The signed release and placement files api-server's prune reads, public. */
const PACKS = 'https://packs.wildshard.io'

interface LiveSet {
  readonly pins: readonly Pin[]
  readonly listed: readonly StoredRecord[]
  readonly live: ReadonlySet<string>
}

/** ZS3 (J507): the API's list, engine's pins and every hash a signed release file or placement names. */
async function liveSet(args: Readonly<CorpusArgs>): Promise<LiveSet> {
  const pins = await readPins(args.pins ?? LIVE_PINS)
  const listed = await listKept({
    api: args.api,
    cache: args.cache,
    validator: '',
  })
  const live = await liveHashes({ packs: PACKS, listed, pins })
  return { pins, listed, live }
}

/** Every live original's row (ZS3, FE13). */
async function corpusRows(
  args: Readonly<CorpusArgs>,
  set: Readonly<LiveSet>,
): Promise<Readonly<{ rows: CorpusRow[]; validator: string }>> {
  const validator = await readVersion()
  const candidate =
    args.candidate === undefined
      ? {}
      : { candidate: await loadCandidate(args.candidate) }
  const only = args.only === undefined ? {} : { only: args.only.split(',') }
  const rows = await runCorpus({
    api: args.api,
    cache: args.cache,
    validator,
    pins: set.pins,
    live: set.live,
    ...candidate,
    ...only,
  })
  return { rows, validator }
}

/** SHARD-COMPAT FE5, ZS3 (J507): every live original that fails blocks; no known-failures list excuses one (a live
 * zone is fixed forward by republishing it). Answers how many block. */
function gateBlocking(rows: readonly CorpusRow[]): number {
  const gate = corpusGate(rows, [])
  if (gate.lines.length > NONE) {
    process.stdout.write(`${gate.lines.join('\n')}\n`)
  }
  return gate.blocking.length
}

/** ZS3: the API's listed originals beyond the live ones; a drifted one blocks. */
async function storeDrift(
  args: Readonly<CorpusArgs>,
  set: Readonly<LiveSet>,
): Promise<number> {
  const kept = classifyKept(set.listed, {
    live: set.live,
    pins: set.pins,
    pointed: await pointedHashes(args.api),
  })
  process.stdout.write(`${keptLines(kept).join('\n')}\n`)
  return kept.drift.length
}

/** `shard-format corpus`: every live original, as stored (FE3, ZS3), gated by FE5's known failures and ZS3's store
 * drift; `--usage` writes FE13's record over the live originals only. */
async function corpusCommand(args: Readonly<CorpusArgs>): Promise<number> {
  const set = await liveSet(args)
  const { rows, validator } = await corpusRows(args, set)
  process.stdout.write(`${corpusReport(rows)}\n`)
  const drift = args.only === undefined ? await storeDrift(args, set) : NONE
  if (args.usage !== undefined) {
    await writeUsage(args.usage, corpusUsage(rows, validator, new Date()))
  }
  const blocking = gateBlocking(rows)
  const drifted = args.strictStore === true && drift > NONE
  return blocking > NONE || drifted ? EXIT_INVALID : EXIT_OK
}

export { corpusCommand }
