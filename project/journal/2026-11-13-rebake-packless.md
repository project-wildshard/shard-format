# 2026-11-13: Brasscap's rebake settles a packless cook, and the gate rebaked

- `rebake.ts --write` broke on today's sharddev: since S5 a sharddev product holds no `packs` (engine cooks them from
  the upload), and the settle read `cooked.packs`. Now, with no cooked packs, each new blob joins the corpus pack that
  held the most of the gone blobs (the one it replaces). `shardfile pack` re-measures every pack's bytes, offsets and
  hash, so only membership is the rebake's call. With cooked packs it works as before.
- Proof: `--write` from a clean clone of main gives the same corpus bytes twice, `--check` is then 235 of 235
  byte-equal, `shardfile validate` passes, and the 65 Brasscap tests pass.
- Then the coordinator's gate patch (M4.12, the gate 50/50: three dark-wood straps and five iron studs a leaf, from the
  cleanroom's `world.js:507-508`) went through the fixed rebake: 5 blobs in, 5 out, sim budget +5496 compressed,
  +90992 resident; `canyon.glb` and `props.glb` regenerated. SS3 moves this corpus to `shard-brasscap` later.
- Commit 2 (the gate): canyon.ts's straps and studs, the regenerated sources and the rebaked corpus, kept apart from
  the rebake fix so the fix stands alone.
