// Vitest takes its defaults here; this file exists so every run, however it starts, loads repo-kit's temp redirect
// (meta docs/plans/TEMP-HYGIENE-PLAN.md). Without a config a bare `vitest run` writes ~1,350 files into $TMPDIR.
import { defineConfig } from 'vitest/config';
import { viteTmpRoot } from './scripts/vite-tmp.mjs';

export default defineConfig({ plugins: [viteTmpRoot()] });
