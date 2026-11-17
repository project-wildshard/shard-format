/** J408 (Jake, 2026-11-17, after Nine crashed his iPhone 17 Pro at boot): the hard line. A worst playing estimate over it
 * refuses in every offline gate (check, shard CI, api-server, the cook) whatever the policy or the report-only switch.
 * Engine's MEMORY_AMBER (src/client/game/grid/budgetOverlay.ts). Decimal bytes. MEMORY-GATES MG4. */
const MEMORY_HARD_BYTES = 1.5e9
const GB = 1e9
const DIGITS = 1

/** The refusal's words for an estimate over the hard line; empty under it. */
function overHardLine(playingBytes: number): string {
  if (playingBytes <= MEMORY_HARD_BYTES) {
    return ''
  }
  return ` (over the ${(MEMORY_HARD_BYTES / GB).toFixed(DIGITS)} GB phone line, J408: a phone would close the page)`
}

export { MEMORY_HARD_BYTES, overHardLine }
