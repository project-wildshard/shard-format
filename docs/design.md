# shardfile: design

Status: draft 2026-11-05: scaffold only; the real design arrives with the import.

Living doc: **how** this repo is built. What it does and why is
`docs/prd.md`. Keep this true as the code changes.

## Today

Only the scaffold exists:

- `src/cli/`: the CLI (`--version`, `--help`; commands arrive with the import).
- `src/test/helpers/`: shared test helpers; `git.ts` makes real git repos in temp dirs.
- `src/scripts/`: repo tooling (asks, md-wrap), plain JS.

## Dependencies

- None of ours.

## Boundaries the checks enforce

- The format imports nothing of ours and no package but `valibot`

## Coming with the import

- `src/format/`
- `docs/SHARDFILE.md`
- `docs/PLATFORM-FILE-FAMILIES.md`
- `docs/SCRIPT-ABI.md`
- `scripts/gen-format-schema.mjs`
- the format half of `validate` in src/sdk/cli.ts (after P1 F3)
- src/format changed 2,403 times in 30 days in singleplayer: batch format changes into tagged releases.
