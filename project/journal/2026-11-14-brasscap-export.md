# 2026-11-14: Brasscap is an export now (SHARD-SOURCE SS4, J342)

- Brasscap Mesa's source moved to `shard-brasscap` in SS3. shard-format keeps only what one pinned commit of it builds:
  `corpus/exports/brasscap-mesa/`, with `brasscap-mesa.pin.json` beside it (commit, file count, tree hash).
- `node src/tools/brasscap-export.ts --commit <rev>` writes it by hand: `git archive` of the commit into
  `tmp/brasscap-export/`, that commit's own lockfile (`--frozen-lockfile --ignore-scripts`), `wildshard build .`, copy.
  `--check` rebuilds and compares. Two runs on 3475153 gave the same tree (59741f8c...), and an extraction in another
  folder built the same bytes, so the build has no path or clock in it.
- three is installed only in that scratch folder; no shard-format `package.json` names it, and a smoke test says so.
- The hand-written corpus, its `corpus/sources/` GLBs and the `src/tools/brasscap/` generators and rebake are gone
  (they live in shard-brasscap `tools/`). The five Brasscap smoke tests read the export; marks and camp positions the
  generators exported are inlined as the pinned commit's numbers, and the wyrm.as text checks moved out with the source.
- The skin-materials format test reads the export's bandit and Wyrm GLBs and skin files instead of generating them.
- Found: the sdk bakes the rack rifle a collider (`world.interactive` needs a `colliderId`); the old rebake filtered it
  after the cook. The rack test keeps the assertion as a todo until the sdk can say "drawn only".
- The export is still an sdk 0.2 draft, as the old corpus was: `wildshard prepare` needs a phone WebKit recording.
- Engine reads `corpus/brasscap-mesa` from the npm package (`scripts/pin-format.ts`); the npm `files` now ship
  `corpus/exports/**`, so engine's path moves with its next format bump (queued for buddy-engine).
