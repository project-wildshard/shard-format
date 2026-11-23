/** FORMAT-PRUNE FP19: unprepared originals and old cook data are deprecated. Neither can be mended by data alone; the
 * box's cook prepares them (SP1b), and they are deleted at FP23 once FE7 counts no kept upload using them. No engine
 * pin uses either. A 0.1.0.3 file with no `preparation` is an author's file before `wildshard prepare` and is not
 * warned; only the old `sdk: '0.2'` marker says a stored original was never prepared. */

/** The registry's row shape (`deprecations.ts`), with what it reads: the index and, from the folder validator, the
 * parsed `cook.json` (the stream validator has none, so it never warns on cook data). */
interface CookDeprecation {
  readonly id: string
  readonly path: string
  readonly since: string
  readonly replacement: string
  readonly migration: undefined
  readonly uses: (
    shard: Readonly<{ index: unknown; cook?: unknown }>,
  ) => boolean
}

const BUILT_SDK = '0.2'
const CURRENT_COOK_DATA = 3
const SINCE = '0.1.0.4'

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Reflect.get(value, key)
    : undefined
}

const COOK_DEPRECATIONS: readonly CookDeprecation[] = [
  {
    id: 'shard.unprepared',
    path: "shard.json sdk '0.2': a stored original built and never prepared (FORMAT-PRUNE FP19)",
    since: SINCE,
    replacement:
      'a prepared file: run wildshard prepare before upload; the box cook prepares old ones (SP1b)',
    migration: undefined,
    uses: (shard: Readonly<{ index: unknown }>): boolean =>
      field(shard.index, 'sdk') === BUILT_SDK,
  },
  {
    id: 'cook.legacy-data',
    path: 'cook.json version 1 or 2 (FORMAT-PRUNE FP19)',
    since: SINCE,
    replacement: 'cook.json version 3 or later, written by wildshard prepare',
    migration: undefined,
    uses: (shard: Readonly<{ cook?: unknown }>): boolean => {
      const version = field(shard.cook, 'version')
      return typeof version === 'number' && version < CURRENT_COOK_DATA
    },
  },
]

export { COOK_DEPRECATIONS }
