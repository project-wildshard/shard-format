# shardfile: design

Status: living 2026-11-05: src/format imported from singleplayer
(`36d00c6645`); `shardfile validate` works; released as v0.1.0.

Living doc: **how** this repo is built. What it does and why is
`docs/prd.md`. Keep this true as the code changes.

## Layout

- `src/format/`: the `@wildshard/format` package, imported from
  `Raynos/project-wildshard-singleplayer` `src/format` (flat, ~320
  modules plus their vitest tests). Every relative import names its
  `.ts` file (J53), so it type-checks under `nodenext` and runs under
  Node's type stripping.
  - `standards/format-standards.d.ts`: the few portable globals the
    library uses (`TextEncoder`, `TextDecoder`, `structuredClone`,
    `WebAssembly.validate`), from singleplayer's `types/`.
  - `standards/node.d.ts`: the same names for Node hosts (the CLI and
    the tests), where Node's types lack them.
  - `ratchet.json`: the lint and format baseline (D29).
- `src/cli/`: the `shardfile` CLI: `validate <dir>`, `--version`,
  `--help`.
- `src/tools/`: repo tooling in TypeScript (`format-ratchet.ts`).
- `src/test/`: shared test helpers and `fixtures/` (a real product).
- `src/scripts/`: template tooling (asks, md-wrap), plain JS.
- `docs/SHARDFILE.md`, `docs/PLATFORM-FILE-FAMILIES.md`,
  `docs/SCRIPT-ABI.md`: the spec, as imported. Their links still point
  into singleplayer (`../scripts/...`, `api/SHARDFILE.md`).

## The public contract (J55)

The valibot schemas are the shardfile contract; there is no JSON
Schema export. Consumers import modules by name through the root
`package.json` `exports` (321 entries, raw `.ts`, J42). There is no
index file: singleplayer forbids barrels (E434), and the entries keep
the names singleplayer's code already imports.

- `@wildshard/format/shardSchema`: `ShardfileSchema` (the whole
  shardfile), `parseShardfile`, `Shardfile`, `ShardfileFieldSchemas`.
- `@wildshard/format/productValidation`: `validateShardfileProduct`
  over a built product folder, through two ports: `ProductFiles`
  (bounded reads, the path list) and `ProductValidationPorts` (SHA-256;
  optional verify cache, JSON Schema check, runtime import check).
  Call `prepareAssetDecoders()` from `@wildshard/format/product` first.
- `@wildshard/format/outputIndex`: the `shard.json` index and section
  schemas.
- The rest: one module per document family, each exporting its
  `*Schema` and parser.

Singleplayer still turns these schemas into JSON Schema for its author
tooling (`src/sdk/formatJsonSchema.ts`, `scripts/gen-format-schema.mjs`,
`.wildshard/format/*.schema.json`). That stays there, for sharddev
(P4); this repo does not depend on it.

## `shardfile validate <dir>`

`src/cli/validate.ts` gives `validateShardfileProduct` Node ports:
`node:crypto` SHA-256, reads bounded by the size the index declares,
symlinks and special files refused, an unlisted file refused without
being read. Exit 0 prints `ok <slug> r<revision>: ...`; exit 3 is an
invalid product. It never runs script bytes: that execution proof is
sharddev's and the cook worker's (F3 (b)).

All ten first-party products built by singleplayer at `36d00c6645`
pass it.

## Dependencies

- `valibot`: every schema.
- `meshoptimizer`: its decoder, for exact GLB costs.
- None of ours.

## Boundaries the checks enforce

- `tsconfig.lib.json` checks the library with ES2022 and the standards
  file only: no Node, no DOM.
- The library imports only `valibot`, `meshoptimizer/decoder` and its
  own modules (`import/no-nodejs-modules` under the ratchet; the
  imported singleplayer rule is not ported).

## Keeping in step with singleplayer

Until singleplayer switches to this repo (MOVES.md step 6), its
`src/format` keeps changing. Before the switch, copy singleplayer's
`src/format` at a newer SHA over this one, keep this repo's files
(`standards/`, `tsconfig*.json`, `ratchet.json`, the test edit noted
in the journal), commit naming the SHA, and run `pnpm lint:format
update` if counts fell. After the switch, format changes land here
first and ship as tagged releases.
