// SHARD-AUTHORING SA41 (SA21's follow-up, J317 Q19): every issue shard-format reports carries a stable `code`, so a
// consumer (sharddev's refusal table, api-server) matches the code instead of the message's words. This is the one
// table; docs/VALIDATION-CODES.md is generated from it (`node src/tools/validation-codes.ts write`) and a test fails when
// the page drifts. A code is stable: rename one only with a release note, since consumers match it. Messages are not
// part of the contract and keep their words.
//
// Where the code is:
// - a validator refusal (`validateShardfileFolder`, `validateShardfileStream`, `readTar`): `error.code` on the thrown
//   Error, its message unchanged. The validators tag by the check that refused; a more specific code set nearer the
//   throw wins. A code that is not the table's (Node's `ENOENT` from a host's file port,
//   `ERR_ENCODING_INVALID_ENCODED_DATA` from bad UTF-8) is replaced: such codes differ by host, and the message keeps
//   its words.
// - a performance report issue: `PerformanceIssue.code`.
// - an audio finding: `AudioFinding.code`; `assertAudioAdmission`'s refusal: `error.code`.

// Validate: both validators, the same code for the same refusal.
const VALIDATE_CODES = {
  'archive-invalid':
    'The tarball is not strict ustar (a bad header, path, padding or end, a truncated entry, too many entries), or the stored object does not decode.',
  'index-invalid':
    '`shard.json` is missing, too large, not canonical JSON, or fails the index schema.',
  'file-mismatch':
    'A listed file is missing, unreadable (a symlink, not a regular file), larger than declared, or its hash or size differs.',
  'section-invalid':
    'A section is not canonical JSON, fails its section schema, or is a `client/plan` kind with no declared side.',
  'script-side':
    'A script runs on a side its declaration does not allow (SERVER-PARITY SS7).',
  'script-admission':
    'The script admission rows the sections declare are invalid.',
  'blob-invalid':
    "A blob's bytes contradict its listing: kind or extension, registered named JSON and its schema, or costs understated.",
  'server-file-invalid':
    'A server file (J91) is unregistered named JSON or its bytes differ from its declared kind.',
  'ktx2-costs':
    'The declared KTX2 device costs differ from the verified bytes.',
  'pack-invalid':
    "A pack is missing a member, or a member or the pack's hash differs.",
  'cook-invalid':
    'The cook file, its preparation, or a mount (path or bytes) is invalid (C0, J137).',
  'runtime-files':
    'Copied runtime files are present without a runtime import checker, or fail it.',
  'unlisted-file': 'A file in the product is not listed in `shard.json`.',
  'shard-schema':
    'The shardfile assembled from the sections fails the shardfile schema.',
  'declared-costs':
    'The declared costs fail preflight: a budget or memory admission over its limit.',
  'performance-targets':
    'A declared performance target over its limit refuses (the `REFUSAL:` lines).',
  'asset-admission':
    "An asset's bytes fail admission: parse, hash or wire size, costs, bounds or script contract.",
  'world-targets':
    '`world/targets` names an item or quest the shardfile does not declare.',
  'source-hash': 'The sections differ from the declared `build.sourceHash`.',
} as const

// Stream: the streaming validator's own refusals, beside the validate codes it shares.
const STREAM_CODES = {
  'stream-cap':
    'A member, pack or the placed assets are over the streaming cap.',
  'stream-miss': 'A check asked for bytes the stream did not hold (AC6a2).',
  'stream-changed': 'The stored object changed between its reads.',
} as const

// Performance: `PerformanceIssue.code`.
const PERFORMANCE_CODES = {
  'perf-memory-target':
    'A resident memory target (tradeable) is over; always a warning.',
  'perf-library-download-budget':
    'The declared library download budget is over the allowance.',
  'perf-critical-download-budget':
    'The declared critical (sim) download budget is over its limit.',
  'perf-library-download':
    "The library closure's download bytes are over the allowance.",
  'perf-critical-download':
    "The critical closure's download bytes are over the limit.",
  'perf-tile-download':
    "A tile's download bytes are over its LOD cap (provisional: a warning).",
  'perf-tile-draws':
    "A tile's draws are over its LOD cap (provisional: a warning).",
  'perf-tile-triangles':
    "A tile's triangles are over its LOD cap (provisional: a warning).",
  'perf-far-download': "The far view's download bytes are over the limit.",
  'perf-far-draws': "The far view's draws are over the limit.",
  'perf-far-triangles': "The far view's triangles are over the limit.",
  'perf-native-view-unmeasured':
    'Native view and download measurement is required and missing.',
  'perf-native-resident-unmeasured':
    'The native runtime declares no measured resident cost.',
  'perf-playing-memory':
    'The worst playing total bytes are over the limit (report-only under G433: a warning).',
  'perf-loading-memory':
    'The worst loading total bytes are over the limit (report-only under G433: a warning).',
  'perf-script-sample-invalid':
    'A measured script or fuel figure is not a finite, non-negative number.',
  'perf-script-cpu': 'Script CPU p95 per tick is over the limit.',
  'perf-script-fuel': 'Script fuel per tick is over the limit.',
  'perf-script-samples-missing': 'Fewer than 60 measured script or fuel ticks.',
} as const

// Audio (AUDIO AU5): `AudioFinding.code`, and the admission refusal.
const AUDIO_CODES = {
  'audio-unreadable':
    'A recording is not readable as AAC-LC 48 kHz mono or stereo (red).',
  'audio-container':
    "A recording's bytes are FLAC, AIFF, Ogg, MP3, WebM, CAF or no known container, not AAC in mp4 or WAV; they still count toward the budget (red).",
  'audio-strict-index':
    'A recording is AAC outside the strict playback index (amber).',
  'audio-wav': 'A recording is PCM WAV; ship AAC-LC 48 kHz (amber).',
  'audio-sample-rate':
    'A recording is AAC at a sample rate other than 48 kHz (amber).',
  'audio-duration': 'A recording runs over the maximum seconds (red).',
  'audio-bitrate':
    "A recording's bitrate is over its role and channel cap plus slack (amber).",
  'audio-budget-amber':
    "The shard's own audio bytes are over the amber line (amber).",
  'audio-budget-red':
    "The shard's own audio bytes are over the red line, with no waiver that holds (red).",
  'audio-budget-waived': 'Over the red line, but a dated waiver holds (amber).',
  'audio-waiver-invalid':
    'The waiver names another shard, has expired, or covers fewer bytes (amber; the red budget finding follows).',
  'audio-refused':
    '`assertAudioAdmission` refuses a report with a red finding.',
} as const

/** Which report a code appears in. */
type IssueFamily = 'validate' | 'stream' | 'performance' | 'audio'

/** Every family's codes and what each means, in table order. */
const ISSUE_FAMILIES: {
  readonly validate: typeof VALIDATE_CODES
  readonly stream: typeof STREAM_CODES
  readonly performance: typeof PERFORMANCE_CODES
  readonly audio: typeof AUDIO_CODES
} = {
  validate: VALIDATE_CODES,
  stream: STREAM_CODES,
  performance: PERFORMANCE_CODES,
  audio: AUDIO_CODES,
}

/** The codes of one family. */
type IssueCodeOf<Family extends IssueFamily> = Family extends IssueFamily
  ? keyof (typeof ISSUE_FAMILIES)[Family]
  : never
/** A stable issue code. */
type IssueCode = IssueCodeOf<IssueFamily>

/** One row of the table. */
interface IssueCodeRow {
  readonly code: IssueCode
  readonly family: IssueFamily
  readonly meaning: string
}

/** A key of a family's own table, as the code it is. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- only ever given the keys of ISSUE_FAMILIES' tables
const asCode = (code: string): IssueCode => code as IssueCode

const FAMILY_ORDER: readonly IssueFamily[] = [
  'validate',
  'stream',
  'performance',
  'audio',
]
const ROWS: readonly IssueCodeRow[] = FAMILY_ORDER.flatMap(
  (family: IssueFamily): IssueCodeRow[] => {
    const table: Readonly<Record<string, string>> = ISSUE_FAMILIES[family]
    return Object.entries(table).map(
      ([code, meaning]: readonly [string, string]): IssueCodeRow => ({
        code: asCode(code),
        family,
        meaning,
      }),
    )
  },
)
const KNOWN: ReadonlySet<string> = new Set(
  ROWS.map((row: IssueCodeRow): string => row.code),
)

/** Every code, in table order. */
function issueCodeRows(): readonly IssueCodeRow[] {
  return ROWS
}

/** Whether a string is one of the table's codes. */
function isIssueCode(value: unknown): value is IssueCode {
  return typeof value === 'string' && KNOWN.has(value)
}

/** The issue code an error carries, if it is one of the table's. */
function issueCodeOf(error: unknown): IssueCode | undefined {
  const code: unknown =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined
  return isIssueCode(code) ? code : undefined
}

/** Give `error` this code unless it already carries one of the table's (a nearer tag); returns it. An own property, so a
 *  read-only `code` getter (a DOMException's) is shadowed rather than thrown on; an error that refuses even that (frozen)
 *  is returned untouched, never replaced. */
function tagIssue(error: unknown, code: IssueCode): unknown {
  if (error instanceof Error && issueCodeOf(error) === undefined) {
    try {
      Object.defineProperty(error, 'code', {
        value: code,
        writable: true,
        enumerable: true,
        configurable: true,
      })
    } catch {
      // A frozen error keeps its own shape; the refusal still surfaces with its words.
    }
  }
  return error
}

/** A new Error with this message and code. */
function issueError(
  code: IssueCode,
  message: string,
): Error & { readonly code: IssueCode } {
  return Object.assign(new Error(message), { code })
}

/** A tarball framing refusal (`tar: ...`): `archive-invalid`. */
function archiveError(message: string): Error & { readonly code: IssueCode } {
  return issueError('archive-invalid', message)
}

/** Run one check; a refusal it throws carries `code` unless it already has one of the table's. */
function withIssueCode<Result>(code: IssueCode, run: () => Result): Result {
  try {
    return run()
  } catch (error) {
    throw tagIssue(error, code)
  }
}

/** `withIssueCode` for an async check. */
async function withIssueCodeAsync<Result>(
  code: IssueCode,
  run: () => Promise<Result>,
): Promise<Result> {
  try {
    return await run()
  } catch (error) {
    throw tagIssue(error, code)
  }
}

export type { IssueCode, IssueCodeOf, IssueCodeRow, IssueFamily }
export {
  ISSUE_FAMILIES,
  archiveError,
  isIssueCode,
  issueCodeOf,
  issueCodeRows,
  issueError,
  tagIssue,
  withIssueCode,
  withIssueCodeAsync,
}
