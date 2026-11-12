// SERVER-PARITY SS7's grandfather list (meta docs/plans/SERVER-PARITY-PLAN.md): the live products admitted with a
// warning in place of a script side refusal (`script-sides.ts`). SS11 empties it.

/** The product a validator is admitting: its slug and declared source hash. Both validators check that hash against
 *  the admitted sections before they return, so a forged index cannot borrow a grandfathered product's. */
interface ScriptSideProduct {
  readonly slug: string
  readonly sourceHash: string
}

/** One live product admitted with a warning in place of a script side refusal. */
interface GrandfatheredScript extends ScriptSideProduct {
  /** The script id the refusal names. */
  readonly script: string
  /** Why it still passes, and the row that removes it. */
  readonly why: string
}

/**
 * GRANDFATHERED (SERVER-PARITY SS7, 2026-11-12; removed by SS11 in meta `docs/plans/SERVER-PARITY-PLAN.md`): live
 * products that still break a script side rule, admitted with a warning so engine can take this format. Each entry is
 * one exact product (slug and source hash) and one script id; any other product, a new upload of the same shard
 * included, is still refused. Drop the entry's line when SS11 re-uploads the shard without the pattern.
 */
// prettier-ignore
const SCRIPT_SIDE_GRANDFATHER: readonly GrandfatheredScript[] = [
  { slug: 'pine-hollow', sourceHash: 'a255585456ff289330fc0a8f7b417b67dca608ebeebcec59b676a7b361f79c15', script: 'pine.life', why: 'the live product; SS5 (engine 2f5e6965) runs its hollow-log secret on the server too, and SS11 moves its page half to a view row' },
]

/** The grandfather entry that covers one refusal line of this product, or `undefined`. */
function grandfatherFor(
  line: string,
  product: ScriptSideProduct,
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
  product: ScriptSideProduct,
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
export type { GrandfatheredScript, ScriptSideProduct }
