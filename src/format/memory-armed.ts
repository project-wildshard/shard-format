import armed from './memory-armed.json' with { type: 'json' }

/** The armed-zone readings are shared with the engine. J445 uses the common
 * loading ceiling for offline refusal and the playing line for reporting. */
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

const HELD_ZONES: Readonly<Record<string, HeldZone>> = Object.freeze(armed.held)

/** True when `slug` is in the armed list (J426). */
function zoneArmed(slug?: string): boolean {
  return slug !== undefined && Object.hasOwn(ARMED_ZONES, slug)
}

/** The common lines for an armed zone. A revision's own reading is evidence,
 * while the offline decision uses the shared target or ceiling (J445). */
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
  HELD_ZONES,
  type HeldZone,
  zoneArmed,
}
