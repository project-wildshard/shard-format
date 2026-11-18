# ONE-FORMAT OF10c1a: a runtime fits its tier

> Written by: Claude (opus-of-m6b), 2026-11-17

`src/format/runtime-tier.ts` adds `runtimeTierIssues`: a shard with a runtime and a reviewed cost (`runtime.cost`,
else `budgets.client`) refuses in `assertShardfileTargets` (build, shard CI, api-server upload, the cook) when
`runtimeAccountedBytes` of that cost exceeds its tier's `memoryBytes`.

- The measured quantity is the runtime's own accounted bytes (what it holds above the engine's resident base): Sky
  Reach 139, Pine 154, Nalati 188, Nine Dragon 325 MiB. The offline whole-home charge (449 to 520 MiB, MG6 epoch 3)
  is J408's hard line's job, not the tier's.
- A shard naming no tier is held to `large` for now, so no current shard refuses before OF10c1b names a tier in each
  runtime shard's source; OF10c1b then makes naming a tier required (`UNNAMED_TIER` goes).
