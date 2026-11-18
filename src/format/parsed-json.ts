// MG10 / ENGINE-MEMORY EM17: checks for a value fresh from `JSON.parse`, which
// is plain data by construction: own enumerable data properties, ordinary
// prototypes, dense arrays, and no symbols, accessors or cycles. `isJsonData`
// reads a property descriptor for every key to prove that of any value; for
// parsed text only its node and depth bounds and canonical numbers are left,
// and this walk checks them without allocating.

type Fields = Readonly<Record<string, unknown>>
type Check = (value: unknown) => boolean

const NONE = 0
const ONE = 1
const NEGATIVE_ZERO = -0
const NODE_LIMIT = 100_000
const DEPTH_LIMIT = 64

const fields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const items = (value: unknown): readonly unknown[] | undefined =>
  Array.isArray(value) ? value : undefined
const own = (value: Fields, key: string): unknown =>
  Object.hasOwn(value, key) ? value[key] : undefined
const canonical = (value: number): boolean =>
  Number.isFinite(value) && !Object.is(value, NEGATIVE_ZERO)

/** One walk's node count, against `isJsonData`'s bound. */
class Walk {
  private nodes = NONE

  public fits(value: unknown, depth: number, skip?: string): boolean {
    this.nodes += ONE
    if (this.nodes > NODE_LIMIT || depth > DEPTH_LIMIT) {
      return false
    }
    if (typeof value === 'number') {
      return canonical(value)
    }
    const list = items(value)
    if (list !== undefined) {
      return this.fitsItems(list, depth + ONE)
    }
    return !fields(value) || this.fitsFields(value, depth + ONE, skip)
  }

  private fitsItems(list: readonly unknown[], depth: number): boolean {
    for (const item of list) {
      if (!this.fits(item, depth)) {
        return false
      }
    }
    return true
  }

  private fitsFields(value: Fields, depth: number, skip?: string): boolean {
    for (const key in value) {
      if (
        Object.hasOwn(value, key) &&
        key !== skip &&
        !this.fits(value[key], depth)
      ) {
        return false
      }
    }
    return true
  }
}

/**
 * `isJsonData`'s verdict for a `JSON.parse` value: at most 100,000 values,
 * none deeper than 64, every number finite and not -0. `skip` leaves one key
 * of the root object out. Only for `JSON.parse` output.
 */
const parsedJsonFits = (value: unknown, skip?: string): boolean =>
  new Walk().fits(value, NONE, skip)

/** An array of at most `max` items, each passing `check`. */
function listOf(value: unknown, max: number, check: Check): boolean {
  const list = items(value)
  if (list === undefined || list.length > max) {
    return false
  }
  for (const item of list) {
    if (!check(item)) {
      return false
    }
  }
  return true
}

export { fields, items, listOf, own, parsedJsonFits }
export type { Check, Fields }
