// oxlint-disable eslint/max-lines, eslint/max-statements, typescript/prefer-readonly-parameter-types -- the old validator's steps in its order, over reads that share state; the state is only read but for the held maps
// `validateShardfileAssets`' byte checks and `checkPacks` over a second read
// of the stored object (API-CLOUDFLARE AC6a2). The first read (product-
// stream.ts) found the index; this one runs `admitFileBytes` on each listed
// file as it streams past, in tarball order, and keeps each refusal as its
// message until `validateShardfileAssets` would have thrown it (its files'
// order). It holds only the files a later check reads by hash: those the
// shard names outside its inventory lists (props, terrain, navigation,
// collision, entryways, near, skins, sketches, recordings, commons). JSON and
// Wasm stay from the first read. A later check that asks for any other file
// is refused, never answered from a guess (StreamMissError): the corpus and pin
// tests prove no check does. Packs the reads' groups need come with them
// (product-stream-packs.ts).

import { admitFileBytes } from './assetAdmission.ts'
import { StreamMissError } from './product-stream-miss.ts'
import { packGroups, packPass } from './product-stream-packs.ts'
import { walkTar } from './product-stream-tar.ts'

import type { AssetAdmission } from './assetAdmission.ts'
import type { OutputIndex } from './outputIndex.ts'
import type { PackPass, PackVerdicts } from './product-stream-packs.ts'
import type { KeptMember } from './product-stream-rows.ts'
import type { StreamHasher, StreamMember } from './product-stream-tar.ts'

/** A stored object to read again: each call opens a fresh stream from its start. */
type StoredSource = () =>
  | AsyncIterable<Uint8Array>
  | Promise<AsyncIterable<Uint8Array>>

interface AssetPassPorts {
  readonly hash: (bytes: Readonly<Uint8Array>) => string
  readonly hasher: () => StreamHasher
  readonly decode?: (
    stored: AsyncIterable<Uint8Array>,
  ) => AsyncIterable<Uint8Array>
}

/** What the later reads found. */
interface AssetPasses {
  /** By `shard.files` row: the refusal `admitFileBytes` gave, if any. */
  readonly fileErrors: readonly (string | undefined)[]
  /** By pack path: the refusal `checkPacks` would give for it, if any. */
  readonly packs: PackVerdicts
  /** The admitted bytes by asset key for the checks after the files. */
  readonly assets: ReadonlyMap<string, Uint8Array>
  /** The most member bytes any later read held, the first read's kept files included. */
  readonly heldBytes: number
  /** The reads taken after the first. */
  readonly reads: number
}

const NONE = 0
const NEXT = 1
/** The most bytes the reads keep for the checks after the files: the first read's kept files and the placed assets. */
const PLACED_HOLD_CAP = 48_000_000
const HASH = /^(?:commons:)?[0-9a-f]{64}$/u
/** Keys under the placed roots whose hashes list files no later check reads by hash: the inventory lists, and prop
 *  library models, textures and materials (`admitFileBytes` reads those while their own GLB streams). */
const SKIPPED_KEYS: ReadonlySet<string> = new Set([
  'files',
  'library',
  'critical',
  'dependencies',
  'materials',
  'models',
  'splat',
  'textures',
])

/** Each asset key's tarball path: `replayFiles`' map, the last listed row of a key winning. */
function assetPaths(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
): Map<string, string> {
  const paths = new Map<string, string>()
  for (const entry of index.files) {
    paths.set(
      `${entry.commons === true ? 'commons:' : ''}${entry.hash}`,
      entry.path,
    )
    if (index.requires.commons.includes(entry.hash)) {
      paths.set(`commons:${entry.hash}`, entry.path)
    }
  }
  return paths
}

/** The parts of a shard whose hashes the checks after the files read: recordings, skin looks, sketches, navigation,
 *  native ground, terrain, collision, props, near content, entryways and the commons. */
function placedRoots(shard: Readonly<AssetAdmission['shard']>): unknown[] {
  return [
    shard.audio.recordings,
    shard.rows.looks,
    shard.rows.compendiums,
    shard.navigation,
    shard.nativeGround,
    shard.terrain,
    shard.meshCollision,
    shard.props,
    shard.near,
    shard.entryways,
    shard.requires.commons.map((hash: string): string => `commons:${hash}`),
  ]
}

/** A string's asset keys, bare or as a pinned commons. */
function hashKeys(value: string, paths: ReadonlyMap<string, string>): string[] {
  if (!HASH.test(value)) {
    return []
  }
  return [value, `commons:${value}`].filter((key: string): boolean =>
    paths.has(key),
  )
}

/** Every asset key named under `value`, skipping `SKIPPED_KEYS`. */
function namedKeys(
  value: unknown,
  paths: ReadonlyMap<string, string>,
): string[] {
  if (typeof value === 'string') {
    return hashKeys(value, paths)
  }
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown): string[] => namedKeys(item, paths))
  }
  if (typeof value !== 'object' || value === null) {
    return []
  }
  return Object.entries(value).flatMap(
    ([key, item]: readonly [string, unknown]): string[] =>
      SKIPPED_KEYS.has(key) ? [] : namedKeys(item, paths),
  )
}

/** The placed keys, and the listed dependencies of the JSON among them (a skin file names its GLB; Codex review). */
function placedKeys(
  shard: Readonly<AssetAdmission['shard']>,
  paths: ReadonlyMap<string, string>,
): Set<string> {
  const rows = new Map(
    shard.files.map(
      (
        row: Readonly<AssetAdmission['shard']['files'][number]>,
      ): readonly [
        string,
        Readonly<AssetAdmission['shard']['files'][number]>,
      ] => [row.hash, row] as const,
    ),
  )
  const keys = new Set(namedKeys(placedRoots(shard), paths))
  for (const key of keys) {
    const row = rows.get(key)
    if (row?.kind === 'json') {
      for (const dependency of row.dependencies) {
        for (const found of hashKeys(dependency, paths)) {
          keys.add(found)
        }
      }
    }
  }
  return keys
}

/** Where the stream holds a file's bytes for the checks. */
interface AssetSources {
  readonly paths: ReadonlyMap<string, string>
  readonly members: ReadonlyMap<string, KeptMember>
  readonly held: ReadonlyMap<string, Readonly<Uint8Array>>
  readonly current: () => Current | undefined
}

/** The file streaming past now. */
interface Current {
  readonly path: string
  readonly bytes: Readonly<Uint8Array>
}

/** The admitted bytes as `validateShardfileAssets` reads them: by key, from what the reads held. */
class StreamAssets extends Map<string, Uint8Array> {
  private readonly sources: AssetSources

  public constructor(sources: AssetSources) {
    super()
    this.sources = sources
    // `for…of` must refuse too; an own property keeps the emitted declaration plain (no computed member).
    Object.defineProperty(this, Symbol.iterator, {
      value: (): never => {
        throw this.walked()
      },
    })
  }

  public override get size(): number {
    return this.sources.paths.size
  }

  public override get(key: string): Uint8Array | undefined {
    const path = this.sources.paths.get(key)
    if (path === undefined) {
      return undefined
    }
    const now = this.sources.current()
    const bytes =
      this.sources.members.get(path)?.bytes ??
      this.sources.held.get(path) ??
      (now?.path === path ? now.bytes : undefined)
    if (bytes === undefined) {
      throw new StreamMissError(
        `stream: an asset check read ${key}, which the stream did not hold`,
      )
    }
    return bytes
  }

  public override has(key: string): boolean {
    return this.sources.paths.has(key)
  }

  public override keys(): MapIterator<string> {
    return this.sources.paths.keys()
  }

  public override values(): MapIterator<Uint8Array> {
    throw this.walked()
  }

  public override entries(): MapIterator<[string, Uint8Array]> {
    throw this.walked()
  }

  public override forEach(): void {
    throw this.walked()
  }

  private walked(): StreamMissError {
    return new StreamMissError(
      `stream: an asset check walked all ${String(this.sources.paths.size)} assets`,
    )
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** What the later reads start from: the opener, the ports, the first read and the index. */
interface AssetPassInput {
  readonly open: StoredSource
  readonly ports: AssetPassPorts
  readonly members: ReadonlyMap<string, KeptMember>
  readonly keptBytes: number
  readonly index: OutputIndex
  readonly admission: AssetAdmission | undefined
}

/** What the later reads need, worked out from the first read and the index. */
interface AssetPlan {
  readonly open: StoredSource
  readonly ports: AssetPassPorts
  readonly members: ReadonlyMap<string, KeptMember>
  readonly keptBytes: number
  readonly index: OutputIndex
  readonly admission: AssetAdmission | undefined
  readonly assets: StreamAssets
  readonly held: Map<string, Readonly<Uint8Array>>
  readonly setCurrent: (current: Current | undefined) => void
  readonly fileErrors: (string | undefined)[]
  readonly rowsByPath: ReadonlyMap<string, readonly number[]>
  readonly keep: ReadonlySet<string>
}

/** One later read's state. */
interface ReadState {
  readonly plan: AssetPlan
  readonly packs: PackPass
  readonly withAssets: boolean
  seen: number
  peak: number
}

/** `admitFileBytes` on each listed row whose bytes stream past; a refusal kept as its message. */
function admitStreamed(
  plan: AssetPlan,
  path: string,
  bytes: Readonly<Uint8Array>,
): void {
  const { admission } = plan
  if (admission === undefined) {
    return
  }
  plan.setCurrent({ path, bytes })
  for (const at of plan.rowsByPath.get(path) ?? []) {
    const row = admission.shard.files[at]
    try {
      if (row !== undefined) {
        admitFileBytes(admission, row, bytes, plan.assets, plan.ports.hash)
      }
    } catch (error) {
      if (error instanceof StreamMissError) {
        throw error
      }
      plan.fileErrors[at] = message(error)
    }
  }
  plan.setCurrent(undefined)
  if (plan.keep.has(path)) {
    plan.held.set(path, bytes)
  }
}

/** The bytes held for the placed checks so far. */
function heldTotal(held: ReadonlyMap<string, Readonly<Uint8Array>>): number {
  let total = NONE
  for (const bytes of held.values()) {
    total += bytes.length
  }
  return total
}

/** One member of a later read: the same bytes as the first read, then its checks. */
function streamedMember(
  state: ReadState,
  path: string,
  found: Readonly<{ sha: string; bytes: Uint8Array | undefined }>,
): void {
  state.seen += NEXT
  if (state.plan.members.get(path)?.sha !== found.sha) {
    throw new Error('stream: the stored object changed between reads')
  }
  const { bytes } = found
  if (bytes !== undefined) {
    state.peak = Math.max(
      state.peak,
      state.plan.keptBytes +
        heldTotal(state.plan.held) +
        state.packs.held() +
        bytes.length,
    )
    if (state.withAssets) {
      admitStreamed(state.plan, path, bytes)
    }
    state.packs.member(path, bytes)
  }
}

/** One later read of the stored object. */
async function oneRead(
  plan: AssetPlan,
  packs: PackPass,
  withAssets: boolean,
): Promise<Readonly<{ peak: number; verdicts: PackVerdicts }>> {
  const state: ReadState = { plan, packs, withAssets, seen: NONE, peak: NONE }
  const wants = new Set([
    ...packs.wants,
    ...(withAssets ? [...plan.rowsByPath.keys(), ...plan.keep] : []),
  ])
  const source = await plan.open()
  const { decode } = plan.ports
  await walkTar(decode === undefined ? source : decode(source), {
    hasher: plan.ports.hasher,
    wants: (path: string): boolean => wants.has(path),
    member: (path: string, found: Readonly<StreamMember>): void => {
      streamedMember(state, path, found)
    },
  })
  if (state.seen !== plan.members.size) {
    throw new Error('stream: the stored object changed between reads')
  }
  return { peak: state.peak, verdicts: packs.finish() }
}

/** The listed rows by tarball path; a row with no file is refused now, as `admitFileBytes` refuses it. */
function rowsAtPaths(
  admission: AssetAdmission | undefined,
  paths: ReadonlyMap<string, string>,
  fileErrors: (string | undefined)[],
): Map<string, number[]> {
  const rowsByPath = new Map<string, number[]>()
  for (const [at, row] of (admission?.shard.files ?? []).entries()) {
    const path = paths.get(row.hash)
    if (path === undefined) {
      fileErrors[at] = 'file hash or wire size mismatch'
    } else {
      rowsByPath.set(path, [...(rowsByPath.get(path) ?? []), at])
    }
  }
  return rowsByPath
}

/** The placed files to hold (those the first read did not keep), refusing a set over `PLACED_HOLD_CAP`. */
function placedPaths(
  first: Readonly<{
    members: ReadonlyMap<string, KeptMember>
    keptBytes: number
  }>,
  admission: AssetAdmission | undefined,
  paths: ReadonlyMap<string, string>,
): Set<string> {
  const keep = new Set<string>()
  let bytes = first.keptBytes
  for (const key of admission === undefined
    ? []
    : placedKeys(admission.shard, paths)) {
    const path = paths.get(key) ?? ''
    const member = first.members.get(path)
    if (member !== undefined && member.bytes === undefined && !keep.has(path)) {
      keep.add(path)
      bytes += member.size
    }
  }
  if (bytes > PLACED_HOLD_CAP) {
    throw new Error('stream: the placed assets are over the streaming cap')
  }
  return keep
}

/** The plan for the later reads. */
function assetPlan(base: AssetPassInput): AssetPlan {
  const paths = assetPaths(base.index)
  const held = new Map<string, Readonly<Uint8Array>>()
  let current: Current | undefined = undefined
  const fileErrors = (base.admission?.shard.files ?? []).map(
    (): undefined => undefined,
  ) as (string | undefined)[]
  return {
    ...base,
    assets: new StreamAssets({
      paths,
      members: base.members,
      held,
      current: (): Current | undefined => current,
    }),
    held,
    setCurrent: (now: Current | undefined): void => {
      current = now
    },
    fileErrors,
    rowsByPath: rowsAtPaths(base.admission, paths, fileErrors),
    keep: placedPaths(base, base.admission, paths),
  }
}

/** The later reads: the asset checks and carried packs with the first group of left-out packs, then one read per
 *  further group. Without an admission (the shard failed before its bytes), only the packs. */
async function assetPasses(base: AssetPassInput): Promise<AssetPasses> {
  const plan = assetPlan(base)
  const order = [...plan.members.keys()]
  const sizes = new Map(
    order.map((path: string): [string, number] => [
      path,
      plan.members.get(path)?.size ?? NONE,
    ]),
  )
  const present = new Set(order)
  const carried = (plan.index.packs ?? []).filter(
    (pack: Readonly<{ path: string }>): boolean => present.has(pack.path),
  )
  const groups = packGroups(plan.index, present, order, sizes)
  const needed =
    plan.admission === undefined && carried.length === NONE ? NONE : NEXT
  const verdicts: PackVerdicts = new Map()
  let heldBytes = plan.keptBytes
  const reads = Math.max(groups.length, needed)
  for (let read = NONE; read < reads; read += NEXT) {
    const packs = packPass(
      plan.index,
      { carried: read === NONE ? carried : [], group: groups[read] ?? [] },
      plan.ports,
    )
    // oxlint-disable-next-line eslint/no-await-in-loop -- one read at a time is the memory bound
    const found = await oneRead(
      plan,
      packs,
      read === NONE && plan.admission !== undefined,
    )
    heldBytes = Math.max(heldBytes, found.peak)
    for (const [path, verdict] of found.verdicts) {
      verdicts.set(path, verdict)
    }
  }
  return {
    fileErrors: plan.fileErrors,
    packs: verdicts,
    assets: plan.assets,
    heldBytes,
    reads,
  }
}

export type { AssetPassInput, AssetPasses, StoredSource }
export { assetPasses }
