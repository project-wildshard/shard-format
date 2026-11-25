// Vitest takes its defaults here; this file exists so every run, however it starts, loads repo-kit's temp redirect
// (meta docs/plans/TEMP-HYGIENE-PLAN.md). Without a config a bare `vitest run` writes ~1,350 files into $TMPDIR.
// Plan worktrees under .worktrees/ are other checkouts: Vitest neither discovers nor watches their files (DS11).
// Lane scratch under tmp/ holds other lanes' tree copies (tmp/<lane>/<sha>/src/...): never this checkout's tests (FORMAT-PRUNE
// FP43: two stale copies turned a push gate red).
import { configDefaults, defineConfig } from 'vitest/config';
import { viteTmpRoot } from './src/scripts/.kit/vite-tmp.mjs';
import { WORKTREE_GLOB, worktreeWatchIgnored } from './src/scripts/.kit/worktree-ignore.mjs';

export default defineConfig({
  plugins: [viteTmpRoot()],
  server: { watch: { ignored: worktreeWatchIgnored() } },
  test: { exclude: [...configDefaults.exclude, WORKTREE_GLOB, 'tmp/**'] },
});
