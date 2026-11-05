# shardfile import

- Imported `src/format` (410 files) and the three spec docs from
  `Raynos/project-wildshard-singleplayer@36d00c6645`, the commit that
  rewrote format's imports to explicit `.ts` (J53). Byte-identical
  except whitespace the hook refuses: one trailing space
  (`audioProfiles.ts:477`) and extra blank lines at EOF in 10 files. `types/format-standards.d.ts` came in
  beside it as `src/format/format-standards.d.ts`.
- No freeze was announced to the singleplayer lanes: format keeps
  changing there until the switch, so the switch re-imports from a
  newer SHA (copy, diff, commit) before singleplayer depends on this.
- Made it green. Root `package.json` is now `@wildshard/format` with
  format's 321 exports (D30); valibot replaces zod (J56). Format
  typechecks under this repo's strict `nodenext` options three ways (CLI
  project, format + tests with Node types, library alone with no Node
  or DOM); only Node's missing `TextDecoder` type and `WebAssembly`
  namespace needed `standards/node.d.ts`.
- Lint: 38,892 strict findings in the imported code. They sit in a
  shrink-only baseline (`src/format/ratchet.json`, D29) instead of an
  exemption; plain lint/fmt skip src/format so the rules stay whole.
- Format's 79 vitest files run as-is under vitest (D31); one test read
  singleplayer's `tsconfig.format.json` and now reads
  `src/format/tsconfig.lib.json`. 419 tests pass.
- `shardfile validate <dir>` over format's F3 validator with Node
  ports. All 10 first-party products singleplayer builds pass it; the
  test fixture is a 48 KB product the singleplayer author SDK wrote.

## Re-import from 1546ceedf8

- Second copy of singleplayer's `src/format`, now from
  `1546ceedf8`, ahead of the switch (MOVES.md step 6, J81). Brings the
  `server` admission class, `nativeAssembly.ts`, the combat fields, and
  the net and standalone schemas: 4 new modules, 16 changed. Same
  whitespace fix as the first import (`audioProfiles.ts:477`, blank
  lines at EOF in 10 files); this repo's test edit, `standards/` and
  tsconfigs kept.
- The 4 new modules join `exports`, plus 6 that singleplayer's tests
  and scripts imported by relative path and so never needed an entry
  (`cellBounds`, `fenceReads`, `glbImages`, `trail`, `uiStrings`,
  `wireLimits`), and `memoryGates.json`, which its scripts read.
- Ratchet: `init` again, because every rise is imported code. The two
  spec docs took the same SHA's edits.
