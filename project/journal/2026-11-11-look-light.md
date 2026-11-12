# Look light settings (LF1-4)

> Written by: Claude (opus-lf14), 2026-11-11 ~23:30 Cancún.

- `look.light` (format `look-light.ts`): optional ao, rim, heightFog and pools, each off when absent; and
  `look.grade.bloom`, so a shardfile shard can declare bloom (engine had it hard-wired to 0, LF1-2's leftover).
- Additive with no filled default: an old product keeps its bytes and source hash. Engine reads them behind a
  default-off Settings ▸ Debug ▸ Look row until Jake picks (meta TEMPLATE-E2E-PLAN LF1-4).
