// SERVER-PARITY SS7's grandfather list (meta docs/plans/SERVER-PARITY-PLAN.md): the live products admitted with a
// warning in place of a script side refusal (`script-sides.ts`). SS11 emptied it.

/** The product a validator is admitting: its slug and declared source hash. Both validators check that hash against
 *  the admitted sections before they return, so a forged index cannot borrow a grandfathered product's. */
interface ScriptSideShardfile {
  readonly slug: string
  readonly sourceHash: string
}

/** One live product admitted with a warning in place of a script side refusal. */
interface GrandfatheredScript extends ScriptSideShardfile {
  /** The script id the refusal names. */
  readonly script: string
  /** Why it still passes, and the row that removes it. */
  readonly why: string
}

/**
 * GRANDFATHERED (SERVER-PARITY SS7, 2026-11-12): live products that still broke a script side rule, admitted with a
 * warning so engine could take this format. Each entry is one exact product (slug and source hash) and one script id; any
 * other product, a new upload of the same shard included, is still refused. Empty since SS11 (2026-11-13): Pine Hollow
 * revision 4 (`1b6dcfb1`, live on every channel) runs `page.life` on the view row `pine.ambient`, so no live product
 * needs a line. A new entry needs a meta SERVER-PARITY row that removes it.
 */
// prettier-ignore
const SCRIPT_SIDE_GRANDFATHER: readonly GrandfatheredScript[] = []

/** The grandfather entry that covers one refusal line of this product, or `undefined`. */
function grandfatherFor(
  line: string,
  product: ScriptSideShardfile,
): GrandfatheredScript | undefined {
  return SCRIPT_SIDE_GRANDFATHER.find(
    (entry: GrandfatheredScript): boolean =>
      entry.slug === product.slug &&
      entry.sourceHash === product.sourceHash &&
      line.startsWith(`sim script ${entry.script} runs in page-only feature `),
  )
}

/** A product's side refusal lines, split: lines a grandfather entry covers become warnings, the rest stay refusals. */
function splitGrandfathered(
  lines: readonly string[],
  product: ScriptSideShardfile,
): { refused: string[]; warnings: string[] } {
  const refused: string[] = []
  const warnings: string[] = []
  for (const line of lines) {
    const entry = grandfatherFor(line, product)
    if (entry === undefined) {
      refused.push(line)
    } else {
      warnings.push(`grandfathered: ${line} (${product.slug}: ${entry.why})`)
    }
  }
  return { refused, warnings }
}

export { SCRIPT_SIDE_GRANDFATHER, splitGrandfathered }
export type { GrandfatheredScript, ScriptSideShardfile }
