// Immutable wire bytes: one stable JSON encoding and the SHA-256 that names
// it, shared by engine's host/immutable and the sdk (SHARD-COMPAT SI1). A
// Node host module, not the portable library: tsconfig.lib.json leaves it
// out, and only this module and shardfile-stream-node.ts import `node:`.

// oxlint-disable-next-line import/no-nodejs-modules -- author tools hash exact immutable wire bytes
import { createHash } from 'node:crypto'

const BEFORE = -1
const AFTER = 1
const SAME = 0

// UTF-16 code-unit order, as `<` compares strings; never locale order.
function byKey(
  [left]: readonly [string, unknown],
  [right]: readonly [string, unknown],
): number {
  if (left < right) {
    return BEFORE
  }
  if (left > right) {
    return AFTER
  }
  return SAME
}

function canonical(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item: unknown): unknown => canonical(item))
  }
  if (typeof input === 'object' && input !== null) {
    const entries = Object.entries(input).toSorted(byKey)
    return Object.fromEntries(
      entries.map(
        ([key, value]: readonly [string, unknown]): [string, unknown] => [
          key,
          canonical(value),
        ],
      ),
    )
  }
  return input
}

/**
 * Stable JSON: object keys sorted by code unit, then `JSON.stringify` and one
 * trailing newline. Integer-like keys still come first in numeric order,
 * because `JSON.stringify` walks own keys that way; the bytes pin that.
 */
function encodeCanonicalJson(value: unknown): string {
  return `${JSON.stringify(canonical(value))}\n`
}

/** SHA-256 of exact wire bytes, independent of installation path or build time. */
function hashImmutableBytes(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export { encodeCanonicalJson, hashImmutableBytes }
