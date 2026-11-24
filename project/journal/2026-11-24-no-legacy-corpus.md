# corpus/legacy is gone (ZONE-SNAPSHOTS ZS5)

> Written by: Claude (lane opus-snap). 2026-11-24.

J507: no old zone snapshots in tests. `corpus/legacy/brasscap-mesa-ss3/` (201 files, 5.1 MB: shard-brasscap
`3475153`'s SS4 export at format 0.1, kept by J506) was deleted by hand, with its pin and its one-way corpus root.
Nothing in it was unique: shard-brasscap holds the source at that commit and this repo's history holds the bytes
(last touched in `4430ed8`). The npm `files` entry `corpus/legacy/**` went with it.

Where its tests went:

- **Chain and validator tests** (format-migrate, format-migration-ops, deprecations, shardfile-stream, issue-codes,
  policy-verdict, memory-hard-line, feature-sides, format-parity, and the CLI helper's `CORPUS` for cook-preparation,
  preparation-spec and hostile-shard) read the made-up CLI product, `src/test/fixtures/cli-fixture` (format 0.1).
- **BM content tests** read the current export, `corpus/exports/brasscap-mesa`. The skin fixture uses the wyrmling,
  whose GLB keeps plain float positions (the bandit's is meshopt-packed).
- **installed** validates and packs the made-up product with the installed bin; no stored zone ships.

Deleted as SS3-only, each failing on the current export because Brasscap's content moved on (shard-brasscap's own
tests cover today's content):

- brasscap-mesa: "the canyon is baked: tiles, collision and one far mesh", "spawn is the canyon GLB spawn empty", and
  the whole-folder validate and pack (the export leaves out its blobs over 1 MB).
- brasscap-bandits: the camp placement, the bandit skin, the gate-opens and the gate-collider tests.
- brasscap-rack, brasscap-quest and brasscap-wyrm: whole files (rack panel and field, the BM-6 quest, the BM-5 Wyrm).
- brasscap-skins: the eye and gullet index counts (the part checks stay).
- shardfile-stream: the prop GLB material-binding mutation and the cook v1 `cook.legacy-data` count (FP23: no cook v1
  export kept); deprecations: the original's manifest-word list (each step's own fixture proves it, ZS4).
- one-way-inventory: the SS3 copy's stored count of nine repeated manifest words.
- hostile-shard: the banned-import Wasm case now runs `admitScriptContract`, the admission each Wasm row passes in a
  host's asset check, since the made-up product holds no script; the understated-cost case uses its tile.

## ZS6: live pins by slug

`shardfile-stream-pins.test.ts` streams the biggest and the median live pin, read by slug from engine's
`test/pins/shardfiles.json` (a sibling checkout, or `WILDSHARD_ENGINE_PINS`), so a pin bump moves it. Deleted by hand:
`shardfile-pine-live-pin.test.ts` (Pine r7, no longer live) and `script-side-grandfather.test.ts` (Pine's old products;
`script-sides.test.ts` keeps the side law on made-up rows). The guard now lets a made-up product under
`src/test/fixtures/` sit at an old format; its baseline holds only Brasscap's export, at 0.1.0.4 until an SDK writes the
current format and it is re-exported (a re-export at shard-brasscap `ca01208` with SDK 0.4.30 still wrote 0.1.0.4).
