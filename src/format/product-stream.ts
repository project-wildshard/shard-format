// API-CLOUDFLARE AC6a: `validateShardfileProduct` over a stream, for a host
// with no disk and no synchronous reads (the API Worker: 128 MB, `node:zlib`,
// no WebAssembly compiled from bytes). One pass over the stored object: its
// SHA-256, its decoding (Brotli, a host port), a strict ustar walk and every
// member's SHA-256 and size. Blobs are checked as they stream and only their
// facts kept (product-stream-facts.ts); JSON, Wasm and every file outside
// `blobs/`, `mounts/` and `packs/` are kept whole. When the walk ends, the old
// validator's steps run in its order, so a refusal is the one it gives (its
// message may differ only for a blob whose declared kind contradicts its path).
//
// NOT YET (AC6a's open half): `validateShardfileAssets`' byte checks (terrain
// seams, navigation, collision, prop draw bounds, entryways, skins, graph
// files, scripts and the per-file cost totals) and the pack member checks.
// They read assets by hash in any order: 153 MB of blobs on the 327 MB pin,
// over a Worker's 128 MB. Until they run the result says `complete: false`
// and names them in `pending`, and a host must not take it for D1's check.

import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits.ts'
import { parseOutputIndex, validateOutputSection } from './outputIndex.ts'
import { admitDeclared } from './product-stream-admit.ts'
import { blobFacts } from './product-stream-facts.ts'
import { listedBytes, replayRows } from './product-stream-rows.ts'
import { walkTar } from './product-stream-tar.ts'
import { prepareAssetDecoders } from './product.ts'
import { readCanonicalJson } from './productValidation.ts'
import { scriptAdmissionRows } from './scriptContract.ts'

import type { OutputIndex } from './outputIndex.ts'
import type { KeptMember, Replay } from './product-stream-rows.ts'
import type {
  StreamHasher,
  StreamMember,
  WalkPorts,
} from './product-stream-tar.ts'
import type { ScriptAdmissionRows } from './scriptContract.ts'
import type { Shardfile } from './shardSchema.ts'

/** The host services a streaming validation needs. */
interface StreamValidationPorts {
  /** Lowercase hex SHA-256 of exact bytes. */
  readonly hash: (bytes: Readonly<Uint8Array>) => string
  /** A fresh incremental SHA-256. */
  readonly hasher: () => StreamHasher
  /** Decode the stored encoding (Brotli: `node:zlib`). Omitted: the stored object is a plain tarball. */
  readonly decode?: (
    stored: AsyncIterable<Uint8Array>,
  ) => AsyncIterable<Uint8Array>
}

/** What one streaming validation found. */
interface StreamedProduct {
  /** SHA-256 and byte length of the stored object, before decoding. */
  readonly hash: string
  readonly bytes: number
  /** Byte length of the decoded tarball. */
  readonly tarBytes: number
  readonly index: OutputIndex
  readonly shard: Shardfile
  readonly sections: ReadonlyMap<string, unknown>
  readonly scripts: ScriptAdmissionRows
  /** True only when every check `validateShardfileProduct` runs has run. */
  readonly complete: boolean
  /** The checks still to run, by name, while `complete` is false. */
  readonly pending: readonly string[]
  /** The most member bytes held at once: everything kept, plus the blob in hand. */
  readonly heldBytes: number
}

/** One pass's result, before the replay. */
interface Walked {
  readonly members: ReadonlyMap<string, KeptMember>
  readonly tarBytes: number
  readonly hash: string
  readonly bytes: number
  readonly heldBytes: number
}

/** The largest blob the walk holds to inspect (format's asset parsers stop at 25 MB). */
const STREAM_BLOB_CAP = 32_000_000
/** The most bytes of kept files (JSON, Wasm, sections, root and server files) held at once. */
const STREAM_KEPT_CAP = 48_000_000
const NONE = 0
const NEXT = 1

/** Whether a member is held whole after its check: everything but blobs, mounts and packs, and JSON and Wasm blobs. */
function keptPath(path: string): boolean {
  if (path.startsWith('mounts/') || path.startsWith('packs/')) {
    return false
  }
  const extension = path.slice(path.lastIndexOf('.') + NEXT)
  return (
    !path.startsWith('blobs/') || extension === 'json' || extension === 'wasm'
  )
}

/** The stored chunks, through their hash and count. */
function tapped(
  source: AsyncIterable<Uint8Array>,
  hasher: StreamHasher,
): Readonly<{ chunks: AsyncGenerator<Uint8Array>; bytes: () => number }> {
  let bytes = NONE
  async function* chunks(): AsyncGenerator<Uint8Array> {
    for await (const chunk of source) {
      hasher.update(chunk)
      bytes += chunk.length
      yield chunk
    }
  }
  return { chunks: chunks(), bytes: (): number => bytes }
}

/** The walk's ports: hold blobs while their facts are taken, keep the small files, and count both. */
function collect(ports: StreamValidationPorts): Readonly<{
  walk: WalkPorts
  members: ReadonlyMap<string, KeptMember>
  peak: () => number
}> {
  const members = new Map<string, KeptMember>()
  let now = NONE
  let peak = NONE
  const wants = (path: string, size: number): boolean => {
    const keep = keptPath(path)
    if (
      (keep && now + size > STREAM_KEPT_CAP) ||
      (!keep && size > STREAM_BLOB_CAP)
    ) {
      throw new Error(`stream: member over the streaming cap: ${path}`)
    }
    return keep || path.startsWith('blobs/')
  }
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the walk's own type: these bytes are kept
  const member = (path: string, found: StreamMember): void => {
    const size = found.bytes === undefined ? NONE : found.bytes.length
    const keep = found.bytes !== undefined && keptPath(path)
    peak = Math.max(peak, now + size)
    now += keep ? size : NONE
    const facts =
      found.bytes === undefined ? undefined : blobFacts(path, found.bytes)
    members.set(path, {
      size: found.size,
      sha: found.sha,
      bytes: keep ? found.bytes : undefined,
      facts,
    })
  }
  return {
    walk: { hasher: ports.hasher, wants, member },
    members,
    peak: (): number => peak,
  }
}

/** The one pass: the stored hash and count, the decode, the tar walk. */
async function walkStored(
  stored: AsyncIterable<Uint8Array>,
  ports: StreamValidationPorts,
): Promise<Walked> {
  const hasher = ports.hasher()
  const tap = tapped(stored, hasher)
  const kept = collect(ports)
  const tarBytes = await walkTar(
    ports.decode === undefined ? tap.chunks : ports.decode(tap.chunks),
    kept.walk,
  )
  return {
    members: kept.members,
    tarBytes,
    hash: hasher.digest(),
    bytes: tap.bytes(),
    heldBytes: kept.peak(),
  }
}

/** `shard.json`, read as `validateShardfileProduct` reads it: bounded, canonical, then parsed. */
function readIndex(replay: Readonly<Replay>): OutputIndex {
  const shardJson = replay.members.get('shard.json')
  if (shardJson === undefined) {
    throw new Error('missing file: shard.json')
  }
  if (shardJson.size > limits.sourceBytes) {
    throw new Error('larger than its declared size: shard.json')
  }
  const listed = {
    path: 'shard.json',
    hash: shardJson.sha,
    bytes: shardJson.size,
  }
  return parseOutputIndex(readCanonicalJson(listedBytes(replay, listed)))
}

/** Each section: listed, hashed, canonical and valid. */
function readSections(
  replay: Readonly<Replay>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's output type, only read
  index: OutputIndex,
): Map<string, unknown> {
  const payloads = new Map<string, unknown>()
  for (const entry of index.sections) {
    const value = readCanonicalJson(listedBytes(replay, entry))
    validateOutputSection(entry.name, value)
    payloads.set(entry.name, value)
  }
  return payloads
}

/** Stream-validate a stored shardfile object (see the file comment). Rejects with the refusal `validateShardfileProduct`
 *  would give first; resolves with `complete: false` while its asset checks are pending. */
async function validateShardfileStream(
  stored: AsyncIterable<Uint8Array>,
  ports: StreamValidationPorts,
): Promise<StreamedProduct> {
  // GLB costs need the meshopt decoder before any blob streams (Codex review: a cold start refused valid GLBs).
  await prepareAssetDecoders()
  const walked = await walkStored(stored, ports)
  const replay = {
    members: walked.members,
    listed: new Set(['validation.json']),
    hash: ports.hash,
  }
  const index = readIndex(replay)
  const sections = readSections(replay, index)
  const scripts = scriptAdmissionRows(sections)
  const pending = [...replayRows(replay, index, scripts), 'assets']
  const shard = admitDeclared(index, sections, ports.hash)
  const { hash, bytes, tarBytes, heldBytes } = walked
  return {
    hash,
    bytes,
    tarBytes,
    index,
    shard,
    sections,
    scripts,
    complete: false,
    pending,
    heldBytes,
  }
}

export type { StreamValidationPorts, StreamedProduct }
export { STREAM_BLOB_CAP, STREAM_KEPT_CAP, validateShardfileStream }
