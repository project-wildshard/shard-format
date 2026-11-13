import type { RecordingMeasure, RecordingRole } from './audio-measure.ts'
import type { AudioWaiver } from './audio-waiver.ts'

// AUDIO AU5 (meta docs/plans/AUDIO-PLAN.md, J299): shardfile owns the audio
// rules, and sharddev's `pack` and api-server's admission run this one check.
// Per recording: AAC-LC 48 kHz, at most 180 s, and a bitrate cap by role and
// channels with 10% slack. Per shard: its own recordings' bytes against the
// budget, AMBER over 4 MB and red over 8 MB. Only a red refuses, and only at
// upload; pack prints every finding as AMBER and still packs. A dated waiver
// in the shard's source (`audio-waiver.json`, carried in the index as
// `admission.audioWaiver`) turns the budget's red into AMBER until its date,
// up to the bytes it names. Bitrate is AMBER, not red: every shard shipped
// before AU7's encoder is at about 97 kbps, and AU9 to AU12 re-encode them.

/** How bad: green passes, AMBER warns, red refuses at upload. */
type AudioLevel = 'green' | 'amber' | 'red'

interface AudioFinding {
  readonly level: 'amber' | 'red'
  readonly rule: 'budget' | 'bitrate' | 'duration' | 'format' | 'waiver'
  readonly message: string
}

interface AudioReport {
  readonly slug: string
  readonly files: number
  readonly bytes: number
  readonly level: AudioLevel
  readonly findings: readonly AudioFinding[]
  readonly recordings: readonly RecordingMeasure[]
}

/** The numbers AU5 fixes; AU7's encoder and AU8's doc cite them. */
interface AudioRules {
  readonly budgetAmberBytes: number
  readonly budgetRedBytes: number
  readonly maxSeconds: number
  readonly sampleRate: number
  readonly slack: number
  /** Kbps caps before slack, by role, for mono and stereo. */
  readonly kbps: Readonly<
    Record<RecordingRole, Readonly<{ mono: number; stereo: number }>>
  >
}

/** What the budget is judged against, beside the rows. */
interface BudgetInput {
  readonly slug: string
  readonly bytes: number
  readonly waiver: Readonly<AudioWaiver> | undefined
  readonly today: string
}

const MB = 1_000_000
const NONE = 0
const ONE_DECIMAL = 1
const MONO = 1
const DATE_LENGTH = 10
const DECIMALS = 2

const AUDIO_RULES: AudioRules = {
  budgetAmberBytes: 4_000_000,
  budgetRedBytes: 8_000_000,
  maxSeconds: 180,
  sampleRate: 48_000,
  slack: 1.1,
  kbps: {
    music: { mono: 48, stereo: 64 },
    sfx: { mono: 40, stereo: 48 },
  },
}

function mb(bytes: number): string {
  return `${(bytes / MB).toFixed(DECIMALS)} MB`
}

/** The cap in kbps for a role and channel count, before slack. */
function bitrateTarget(role: RecordingRole, channels: number): number {
  const caps = AUDIO_RULES.kbps[role]
  return channels === MONO ? caps.mono : caps.stereo
}

function formatProblem(
  row: Readonly<RecordingMeasure>,
): AudioFinding | undefined {
  const rate = String(row.sampleRate)
  if (row.codec === 'wav') {
    const message = `${row.url} is PCM WAV at ${rate} Hz; ship AAC-LC 48 kHz`
    return { level: 'amber', rule: 'format', message }
  }
  if (row.sampleRate !== AUDIO_RULES.sampleRate) {
    const message = `${row.url} is ${rate} Hz AAC; ship 48 kHz`
    return { level: 'amber', rule: 'format', message }
  }
  return undefined
}

function formatFinding(row: Readonly<RecordingMeasure>): AudioFinding[] {
  if (row.codec === 'unreadable') {
    const why = row.reason ?? 'unknown'
    const message = `${row.url} is not AAC-LC 48 kHz mono or stereo (${why})`
    return [{ level: 'red', rule: 'format', message }]
  }
  const problem = formatProblem(row)
  return problem === undefined ? [] : [problem]
}

function durationFinding(row: Readonly<RecordingMeasure>): AudioFinding[] {
  if (row.seconds <= AUDIO_RULES.maxSeconds) {
    return []
  }
  const message = `${row.url} runs ${row.seconds.toFixed(ONE_DECIMAL)} s, over ${String(AUDIO_RULES.maxSeconds)} s`
  return [{ level: 'red', rule: 'duration', message }]
}

function bitrateFinding(row: Readonly<RecordingMeasure>): AudioFinding[] {
  const target = bitrateTarget(row.role, row.channels)
  if (row.codec !== 'aac' || row.kbps <= target * AUDIO_RULES.slack) {
    return []
  }
  const layout = row.channels === MONO ? 'mono' : 'stereo'
  const message = `${row.url} is ${row.kbps.toFixed(ONE_DECIMAL)} kbps ${layout} ${row.role}, over ${String(target)} kbps (+10%)`
  return [{ level: 'amber', rule: 'bitrate', message }]
}

function fileFindings(row: Readonly<RecordingMeasure>): AudioFinding[] {
  return [
    ...formatFinding(row),
    ...durationFinding(row),
    ...bitrateFinding(row),
  ]
}

/** Why a present waiver does not hold, or undefined when it does. */
function waiverGap(
  waiver: Readonly<AudioWaiver>,
  input: Readonly<BudgetInput>,
): string | undefined {
  if (waiver.shard !== input.slug) {
    return 'names another shard'
  }
  if (input.today > waiver.until) {
    return 'expired'
  }
  if (input.bytes > waiver.maxBytes) {
    return `covers ${mb(waiver.maxBytes)}, not ${mb(input.bytes)}`
  }
  return undefined
}

function redBudget(input: Readonly<BudgetInput>): AudioFinding[] {
  const over = `${input.slug} holds ${mb(input.bytes)} of its own audio, over the ${mb(AUDIO_RULES.budgetRedBytes)} red line`
  const { waiver } = input
  if (waiver === undefined) {
    return [{ level: 'red', rule: 'budget', message: over }]
  }
  const gap = waiverGap(waiver, input)
  if (gap === undefined) {
    const message = `${over}; waived until ${waiver.until} (${waiver.reason})`
    return [{ level: 'amber', rule: 'budget', message }]
  }
  const named = `waiver for ${waiver.shard} until ${waiver.until} ${gap}`
  return [
    { level: 'amber', rule: 'waiver', message: named },
    { level: 'red', rule: 'budget', message: over },
  ]
}

function budgetFindings(input: Readonly<BudgetInput>): AudioFinding[] {
  if (input.bytes <= AUDIO_RULES.budgetAmberBytes) {
    return []
  }
  if (input.bytes > AUDIO_RULES.budgetRedBytes) {
    return redBudget(input)
  }
  const message = `${input.slug} holds ${mb(input.bytes)} of its own audio, over the ${mb(AUDIO_RULES.budgetAmberBytes)} line`
  return [{ level: 'amber', rule: 'budget', message }]
}

function levelOf(findings: readonly AudioFinding[]): AudioLevel {
  if (
    findings.some((row: Readonly<AudioFinding>): boolean => row.level === 'red')
  ) {
    return 'red'
  }
  return findings.length === NONE ? 'green' : 'amber'
}

/** `YYYY-MM-DD` of a date, in UTC. */
function isoDay(date: Readonly<Date>): string {
  return date.toISOString().slice(NONE, DATE_LENGTH)
}

/** One row per hash: a recording held at two URLs counts once. */
function uniqueRows(
  recordings: readonly RecordingMeasure[],
): RecordingMeasure[] {
  const unique = new Map<string, RecordingMeasure>()
  for (const row of recordings) {
    if (!unique.has(row.hash)) {
      unique.set(row.hash, row)
    }
  }
  return [...unique.values()]
}

/** The shard's audio against AU5's rules; `budget` is the slug, waiver and `YYYY-MM-DD` day. */
function audioReport(
  recordings: readonly RecordingMeasure[],
  budget: Readonly<Omit<BudgetInput, 'bytes'>>,
): AudioReport {
  const rows = uniqueRows(recordings)
  const bytes = rows.reduce(
    (sum: number, row: Readonly<RecordingMeasure>): number => sum + row.bytes,
    NONE,
  )
  const findings = [
    ...budgetFindings({ ...budget, bytes }),
    ...rows.flatMap((row: Readonly<RecordingMeasure>): AudioFinding[] =>
      fileFindings(row),
    ),
  ]
  const level = levelOf(findings)
  return {
    slug: budget.slug,
    files: rows.length,
    bytes,
    level,
    findings,
    recordings: rows,
  }
}

/** The totals, then one AMBER line per finding; pack prints these and still packs. */
function audioReportLines(report: Readonly<AudioReport>): string[] {
  const state = report.level === 'green' ? 'green' : 'AMBER'
  const lines = [
    `audio ${state}: ${report.slug} ${String(report.files)} recordings, ${mb(report.bytes)} (AMBER over ${mb(AUDIO_RULES.budgetAmberBytes)}, red over ${mb(AUDIO_RULES.budgetRedBytes)})`,
  ]
  for (const finding of report.findings) {
    const refuses =
      finding.level === 'red' ? ' (red: api-server refuses this at upload)' : ''
    lines.push(`AMBER audio ${finding.rule}: ${finding.message}${refuses}`)
  }
  return lines
}

/** Refuse a red report: admission's half of AU5. */
function assertAudioAdmission(report: Readonly<AudioReport>): void {
  const red = report.findings
    .filter((row: Readonly<AudioFinding>): boolean => row.level === 'red')
    .map((row: Readonly<AudioFinding>): string => row.message)
  if (red.length > NONE) {
    throw new Error(
      `Audio rules (AU5) refuse ${report.slug}: ${red.join('; ')}`,
    )
  }
}

export type { AudioFinding, AudioLevel, AudioReport, AudioRules }
export {
  AUDIO_RULES,
  assertAudioAdmission,
  audioReport,
  audioReportLines,
  isoDay,
}
