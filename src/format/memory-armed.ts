import armed from './memory-armed.json' with { type: 'json' }

/**
 * J426 (Jake, 2026-11-18, "get the shard passing the memory gate and then to LOCK THE GATE IN. And make it fail hard /
 * mandatory") on J424 ("the gates should only block once an agent has done the work to get it under the gate"): the
 * one armed-zone list, `memory-armed.json`. Every memory gate refuses an armed zone over its line, whatever the policy
 * or the report-only switch; it reports every other zone. Engine's guards read the same JSON.
 */
interface ArmedZone {
  readonly armed: string
  readonly by: string
  readonly epoch: number
  readonly playingBytes: number
  readonly loadingBytes: number
  readonly evidence: string
}

type ArmedKind = 'playing' | 'loading'

const ARMED_LINES: Readonly<Record<ArmedKind, number>> = Object.freeze({
  playing: armed.lines.playingBytes,
  loading: armed.lines.loadingBytes,
})

const ARMED_ZONES: Readonly<Record<string, ArmedZone>> = Object.freeze(
  armed.zones,
)

/** True when `slug` is in the armed list (J426). */
function zoneArmed(slug?: string): boolean {
  return slug !== undefined && Object.hasOwn(ARMED_ZONES, slug)
}

/** The J410 line an armed zone's offline estimate refuses over, or undefined for a zone that only reports. */
function armedLine(
  slug: string | undefined,
  kind: ArmedKind,
): number | undefined {
  return zoneArmed(slug) ? ARMED_LINES[kind] : undefined
}

export {
  ARMED_LINES,
  ARMED_ZONES,
  type ArmedKind,
  type ArmedZone,
  armedLine,
  zoneArmed,
}
