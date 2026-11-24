import armed from './memory-armed.json' with { type: 'json' }

type ArmedKind = 'playing' | 'loading'

/** FORMAT-PRUNE FP27b: the zone a memory gate judges. Admission passes the API catalogue's `armed` beside the slug
 *  (`{ slug, armed }`); since FP27c the format keeps no list, so a bare slug is not armed and reports only (J424). */
type ZoneRef =
  | string
  | undefined
  | Readonly<{ slug?: string | undefined; armed: boolean }>

/** The zone as a gate takes it: the catalogue's word when admission gave one (this shard's, or the catalogue's armed
 *  slugs when the host reads the slug only from the file), else the bare slug. */
function armedZone(
  slug: string | undefined,
  catalogue?: boolean | ReadonlySet<string>,
): ZoneRef {
  if (catalogue === undefined) {
    return slug
  }
  const word =
    typeof catalogue === 'boolean'
      ? catalogue
      : slug !== undefined && catalogue.has(slug)
  return { slug, armed: word }
}

function slugOf(zone: ZoneRef): string | undefined {
  return typeof zone === 'object' ? zone.slug : zone
}

const ARMED_LINES: Readonly<Record<ArmedKind, number>> = Object.freeze({
  playing: armed.lines.playingBytes,
  loading: armed.lines.loadingBytes,
})

/** True when the zone is armed (J426): the API catalogue's word, which admission passes (FP27b). A bare slug carries no
 *  word: since FP27c the format keeps no armed list, so it reports only (J424). */
function zoneArmed(zone?: ZoneRef): boolean {
  return typeof zone === 'object' && zone.armed
}

/** The common lines for an armed zone. A revision's own reading is evidence,
 * while the offline decision uses the shared target or ceiling (J445). */
function armedLine(zone: ZoneRef, kind: ArmedKind): number | undefined {
  return zoneArmed(zone) ? ARMED_LINES[kind] : undefined
}

type RatchetMetric = 'playing' | 'loading' | 'runtime'

/** J445: only the common loading ceiling can refuse an armed shard. Playing and runtime tier overages are reported. */
function ratchetLimit(
  zone: ZoneRef,
  metric: RatchetMetric,
  line: number,
): number {
  return metric === 'loading' && zoneArmed(zone)
    ? line
    : Number.POSITIVE_INFINITY
}

/** Describe the offline decision for a measured overage. */
function ratchetSeverity(
  zone: ZoneRef,
  metric: RatchetMetric,
  reading: Readonly<{ line: number; actual: number }>,
): 'refusal' | 'warning' {
  return reading.actual > ratchetLimit(zone, metric, reading.line)
    ? 'refusal'
    : 'warning'
}

/** The words a reported (not refused) issue carries: why it only reports (J424). */
function ratchetNote(zone: ZoneRef): string {
  return zoneArmed(zone)
    ? ''
    : ` (report-only, J424: ${slugOf(zone) ?? 'this shard'} is not armed)`
}

/** True when a stale runtime reading only reports: J424, every zone not armed (J426). */
function staleReadingAdmitted(zone: ZoneRef): boolean {
  return !zoneArmed(zone)
}

export {
  ARMED_LINES,
  type ArmedKind,
  type ZoneRef,
  armedLine,
  armedZone,
  type RatchetMetric,
  ratchetLimit,
  ratchetNote,
  ratchetSeverity,
  staleReadingAdmitted,
  zoneArmed,
}
