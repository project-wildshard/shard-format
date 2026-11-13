# Immutable export and parseShardfileField (SHARD-COMPAT SI1)

- Added `@wildshard/shard-format/immutable` (`encodeCanonicalJson`,
  `hashImmutableBytes`) and `parseShardfileField` on `./shardSchema`, so
  engine's `host/immutable` and `host/shardfile` can re-export them at the
  next pin bump and the sdk's byte-for-byte copy can import them. Rides the
  next shard-format release; no tag here.
- `immutable.ts` is a Node host module (`node:crypto`), left out of
  `tsconfig.lib.json` beside `product-stream-node.ts`; a test pins that only
  those two import `node:`.
- The fixture test pins engine `26979378`'s exact bytes and sha256. Surprise
  worth keeping: integer-like keys (`"9"`, `"10"`) still come out first in
  numeric order, because `JSON.stringify` walks own keys that way after the
  sort. Engine has that quirk, so the bytes pin it rather than fix it.
- `parseShardfile` and the new field parser share one `export { }` so the
  src/format ratchet's `group-exports` count doesn't rise; the field
  parser keeps engine's cast with a documented lint disable.
