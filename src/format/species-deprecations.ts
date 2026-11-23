/** FORMAT-PRUNE FP15: the species-program family's page features. OF30's cut B leaves the `species.program` client row
 * and the `population.product-creatures` and `population.hull-book` plan features reading only what the family's
 * sections held; each creature is a declared row now (ONE-FORMAT OF5b2b). The sections themselves are FE7 rows in
 * `deprecations.ts`. No data migration exists: a shard drops the feature when it re-uploads (Track F), and FP20 deletes
 * it at zero users. `legacyKinds` sits inside `actors/species-programs`, so that section's row counts it. */

/** The registry's row shape (`deprecations.ts`). */
interface SpeciesFeatureDeprecation {
  readonly id: string
  readonly path: string
  readonly since: string
  readonly replacement: string
  readonly migration: undefined
  readonly uses: (
    shard: Readonly<{ sections: ReadonlyMap<string, unknown> }>,
  ) => boolean
}

/** The sections a page feature row can sit in. */
const FEATURE_SECTIONS: readonly string[] = ['client/plan', 'sim/runtime-plan']
const NONE = 0

/** Whether any object under `value` is a row of `kind`. */
function hasKind(value: unknown, kind: string): boolean {
  const pending: unknown[] = [value]
  while (pending.length > NONE) {
    const next = pending.pop()
    if (typeof next === 'object' && next !== null) {
      if (!Array.isArray(next) && Reflect.get(next, 'kind') === kind) {
        return true
      }
      const children: readonly unknown[] = Object.values(next)
      pending.push(...children)
    }
  }
  return false
}

function featureRow(kind: string): SpeciesFeatureDeprecation {
  return {
    id: `feature.${kind}`,
    path: `client/plan or sim/runtime-plan rows of kind ${kind} (the species-program family, FORMAT-PRUNE FP15)`,
    since: '0.1.0.4',
    replacement:
      'declared creature rows (actors/creatures and their looks); the engine draws each from its row',
    migration: undefined,
    uses: (
      shard: Readonly<{ sections: ReadonlyMap<string, unknown> }>,
    ): boolean =>
      FEATURE_SECTIONS.some((name: string): boolean =>
        hasKind(shard.sections.get(name), kind),
      ),
  }
}

/** OF30 cut B leaves these sections as plain JSON nothing reads. Deprecated at 0.1.0.1 (format `cda6f63`). */
const SPECIES_SECTION_DEPRECATIONS: readonly SpeciesFeatureDeprecation[] = [
  'actors/species-programs',
  'look/hull-book',
  'look/rigged-hulls',
].map((name: string): SpeciesFeatureDeprecation => ({
  id: `section.${name}`,
  path: `sections/${name} (the species-program family, FORMAT-PRUNE FP15)`,
  since: '0.1.0.1',
  replacement:
    'species rows and authored looks (actors/species); nothing reads it once OF30 lands',
  migration: undefined,
  uses: (
    shard: Readonly<{ sections: ReadonlyMap<string, unknown> }>,
  ): boolean => shard.sections.has(name),
}))

const SPECIES_FEATURE_DEPRECATIONS: readonly SpeciesFeatureDeprecation[] = [
  featureRow('species.program'),
  featureRow('population.product-creatures'),
  featureRow('population.hull-book'),
]

export { SPECIES_FEATURE_DEPRECATIONS, SPECIES_SECTION_DEPRECATIONS }
