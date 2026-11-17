/* oxlint-disable curly, import/group-exports, typescript/explicit-function-return-type -- verbatim port of the engine's law (SDK-SPLIT SP4); golden vectors pin it, so it keeps the engine's form */
/** SDK-SPLIT SP4f1 (Q35): moved from engine `shared/host/headlessSections.ts`; the build and the headless worker read one list. */
import { parsePlatformDataSection } from './platformDataSections.ts'

/** One defining context catalogue for author-build intake and worker transport. */
export const HEADLESS_CONTEXT_SECTIONS = [
  'actors/species-programs',
  'view/modules',
  'sim/scripts',
  'actors/spawn-scripts',
  'actors/return-scripts',
  'actors/moves',
  'actors/strikes',
  'world/targets',
  'sim/runtime-plan',
  'sim/bodies',
] as const

/** Explicit admitted decision/move context crossing the worker boundary; no ABI is inferred from bytes. */
export function headlessSections(
  input?: ReadonlyMap<string, unknown>,
): Map<string, unknown> {
  const sections = new Map<string, unknown>()
  for (const name of HEADLESS_CONTEXT_SECTIONS) {
    if (input?.has(name) === true)
      sections.set(name, parsePlatformDataSection(name, input.get(name)))
  }
  return sections
}

/** What a shard product lends this list: its sections by name (the engine's `ShardProduct`, structurally). */
export interface HeadlessSectionSource {
  readonly has: (name: string) => boolean
  readonly section: (name: string) => unknown
}

/** Forward the complete verified native context, including targets and plan selection. */
export function productHeadlessSections(
  product: HeadlessSectionSource,
): Map<string, unknown> {
  return headlessSections(
    new Map(
      HEADLESS_CONTEXT_SECTIONS.filter(name => product.has(name)).map(name => [
        name,
        product.section(name),
      ]),
    ),
  )
}
