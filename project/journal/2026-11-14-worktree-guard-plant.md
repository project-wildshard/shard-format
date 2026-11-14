# 2026-11-14: the worktree guard's plant stays invisible (DS11)

- opus-ss4b's pre-push lint refused a stale guard plant (`.worktrees/ds11-guard-*`, left by an interrupted guard run):
  shard-format's `.gitignore` is an old create-only kit seed without `/.worktrees/`, and oxlint and oxfmt skip only what
  Git ignores, so any lint beside a guard run saw its planted lint error and 1 MB file.
- `.gitignore` gains `/.worktrees/`; `vitest.config.ts` excludes and stops watching `.worktrees/**`, as sharddev's does.
- The guard (repo-kit's copy too) plants only where Git ignores the plant, removes it on SIGINT and SIGTERM, sweeps
  `ds11-guard-*` plants older than an hour, and splits package scripts on shell operators outside quotes only (shard-format's
  `'src/!(format|ci)/**/*.test.ts'` read as two broken globs). It passes 8 of 8 here now.
