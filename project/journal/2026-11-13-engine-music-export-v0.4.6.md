# Export the engine music slots, and a changelog for v0.4.6

> Written by: Claude

AU18's engine lane (engine `8850b104`) needed `ENGINE_MUSIC_SLOTS` for its drift test, which checks that the engine's
piano style has exactly the slots this package admits. The module had no entry in `exports`, so the test read the
source file through a `node_modules` path instead. That works only for a git install and breaks the day the path
moves. `./engineMusic` now points at `src/format/engine-music.ts`; `src/ci/installed.test.ts` proves the packed
tarball hands out the same list as the tree. Engine can switch its import once it pins v0.4.6.

v0.4.6 is also this repo's first `CHANGELOG.md` section. Meta's rule (Jake, 2026-11-10) asks every engine version for
plain-language notes; shard-format now publishes to npm, so authors get the same: one to five bullets per release,
written before the tag. docs/dev.md's release steps say so.
