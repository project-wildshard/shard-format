# A format push typechecks engine first

- meta QA 11-25 row 38: the optional grass cards (bf0a72b2) left engine
  main failing its typecheck against format main, and nothing here could
  see it; it would have surfaced at the next engine format pin.
- `scripts/engine-typecheck.mjs` runs last in `pnpm check` (the push
  gate): engine's origin/main, extracted without public/project/docs,
  installed from the store, this format linked in, engine's own
  `pnpm run typecheck`. About 19 s. A red refuses the push.
- Skips on CI and with no engine checkout. Escape hatch (J381):
  `SKIP_ENGINE_TYPECHECK=1`, named in the commit body.
