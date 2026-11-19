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

/** J424 (QA 11-18 row 29): a zone armed once but held out of `ARMED_ZONES` while engine pins an older product of it
 *  that reads over its line. It reports only; it moves back to `zones` (re-armed) when its engine re-pin lands. */
interface HeldZone extends ArmedZone {
  readonly held: string
}

const HELD_ZONES: Readonly<Record<string, HeldZone>> = Object.freeze(
  armed.held,
)

/** True when `slug` is in the armed list (J426). */
function zoneArmed(slug?: string): boolean {
  return slug !== undefined && Object.hasOwn(ARMED_ZONES, slug)
}

/** A rebuild of the same source moves the computed estimate by packing and compression drift only. */
const ARMED_ALLOWANCE = 0.005

/** What an armed zone's offline estimate refuses over: the J410 line, or, when the conservative estimate of a source
 *  that EM11 measured under the line already reads over it (Nine's playing), that reading at arming plus the
 *  allowance, so the gate locks in the measured state and refuses any growth. Undefined for a zone that only reports. */
function armedLine(
  slug: string | undefined,
  kind: ArmedKind,
): number | undefined {
  const zone =
    slug === undefined || !zoneArmed(slug) ? undefined : ARMED_ZONES[slug]
  return zone === undefined ? undefined : zoneLine(zone, kind)
}

/** The line a zone's entry locks at: the J410 line, or its reading at arming plus the allowance when that is higher. */
function zoneLine(zone: ArmedZone, kind: ArmedKind): number {
  const armedBytes = kind === 'playing' ? zone.playingBytes : zone.loadingBytes
  return Math.max(
    ARMED_LINES[kind],
    armedBytes + Math.floor(armedBytes * ARMED_ALLOWANCE),
  )
}

export {
  ARMED_ALLOWANCE,
  ARMED_LINES,
  ARMED_ZONES,
  type ArmedKind,
  type ArmedZone,
  armedLine,
  HELD_ZONES,
  type HeldZone,
  zoneArmed,
  zoneLine,
}
