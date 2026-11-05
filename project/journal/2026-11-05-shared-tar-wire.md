# Shared tar, hook and wire (api-server's V10)

- `tar.ts`, the format hook and the upload's wire schemas were copied
  between api-server and sharddev. Format is the repo both may depend on,
  so they live here now, and `writeTar` joins `readTar` for
  `wildshard pack`.
- The hook could not move as .ts: it is what lets Node load .ts from
  `node_modules`, so a .ts hook in `node_modules` would need itself.
  Hence `src/hook/format-hook.mjs` and a hand-written `.d.mts`. A real
  Node process proves both sides of that in `format-hook.test.ts`.
- `writeTar` is deterministic (sorted, no mtime, no owners, no directory
  entries) because the tarball's hash is the shardfile's identity.
- `gridCatalogue` is singleplayer's `catalogue.ts` schema: api-server has
  to admit what the client admits. It parses the real
  `singleplayer.json` at `455c2074a7`, all 25 cells and 28 placements.
  Singleplayer's copy stays until C3 bumps its pin.
- `_template` is the authored slug; a product's `identity.slug` cannot
  start with an underscore. `shardSlugOf` is the mapping.
- New `src/format` files had to be ratchet-clean, so they have
  kebab-case names behind camelCase `exports` keys, and named valibot
  imports where the old files use `* as v`.
