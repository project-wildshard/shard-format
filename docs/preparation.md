# Preparation: what a shard file carries that its author computed

> Written by: Claude (opus-compat-w1), 2026-11-21. Owner: shard-format. Decision: meta J487 (Jake, 2026-11-21 ~14:28 and
> ~14:32 Cancún). Plan: meta SHARD-COMPAT PR2 to PR7; inventory at meta
> `project/evidence/shard-compat/2026-11-21-preparation-inventory.md`.

**The rule (J487).** Every value the MMO server, the box's cook or the API needs that is computed from a shard,
rather than authored, is **preparation**. The author's machine makes it before upload (`wildshard publish`); the
API takes only prepared files and refuses one whose preparation does not validate. Preparation names no engine
version and depends on no engine release: it records the **preparation spec version** it was made to, owned by
this package, and any engine that reads that spec accepts it.

This page is the spec. Each section says what a value means, how it is computed, where it lives in the file, which
consumer reads it and which schema checks it. A value whose computation changes moves the preparation spec version
(PR4); a stored file at an older spec is migrated, or re-prepared by the box's cook when no migration can compute it
(SP1b, J486 migrate first).

## The preparation spec version (PR4)

shard-format owns one number, the **preparation spec version**, beside the format version. A prepared file records
it twice: `shard.json` `preparation` (from format 0.1.0.3) and `cook.json` `version`, and the two must agree. Read it
with `preparationSpecOf(index)` (`src/format/cook-preparation.ts`); `undefined` means unprepared.

| Spec | `cook.json` | Names an engine? | Written by |
|---|---|---|---|
| 3 | `version: 3`, `renderer` fingerprint, programs `{version: 2, build, ...}` | yes: the renderer and the program build | `wildshard prepare` up to SDK 0.4.25; formats up to 0.1.0.2 mark it `sdk: '0.3'` |
| 4 | `version: 4`, no `renderer`, programs `{version: 3, lines, shaders, programs}` with no `build`; `inputHash` binds no renderer | no | `wildshard prepare` from the SDK that writes format 0.1.0.3 |

Format 0.1.0.3 drops the `sdk` marker (`'0.2'` built, `'0.3'` prepared). The chain step `pr4-preparation-marker`
turns `sdk: '0.3'` into `preparation: 3` and drops `sdk: '0.2'`; it is data only, so a migrated copy keeps its spec 3
`cook.json` and its input hash is re-sealed. The deprecation counter reports the old marker as `shard.sdk-marker`.
Writers pass their legacy rows through `outputIndexEnvelope` at version 0.1.0.3 with `preparation` set (or `sdk:
'0.3'`, which becomes spec 3). Spec 4's programs are a warm-up hint: any engine may use or ignore them, and none refuses
a file for them.

## Status

| Section | Spec | Schema | Engine agnostic today |
|---|---|---|---|
| `cook.json` mounts | below | `CookDataSchema` (`src/format/cook-data.ts`) | yes |
| `cook.json` fence | below | `CookPreparationSchema.fence` (`src/format/cook-preparation.ts`) | **no**: recorded by an engine boot |
| `cook.json` programs | below | `EntryProgramsSchema` (spec 3), `SpecProgramsSchema` (spec 4) | spec 4 names no build; the GLSL still comes from one renderer (a hint) |
| `cook.json` renderer | below | `CookPreparationSchema.renderer` (spec 3 only) | spec 3 **no**; spec 4 drops it |
| `cook.json` inputHash | below | `cookPreparationBytes` (`src/format/cook-preparation.ts`) | yes, but it binds `renderer` |
| `validation.json` | below | `ValidationReceipt` (`src/format/validationReceipt.ts`) | yes (format costs) |
| `sim/runtime-plan` baked pieces | below | `src/format/headless-sections.ts` | yes |
| `server/native-assembly.json` | below | `src/format/nativeAssembly.ts` | yes |
| Terrain, mesh-collision and navigation blobs | below | `terrainTileBytes.ts`, `meshCollisionBytes.ts`, `navigationBytes.ts` | yes |
| Hero card | below | the discovery mount, `manifest.card`, `presentation.card` | yes |
| Creature volumes, collider shapes, seal solids, server rows, entry read set, road edges | planned (PR6a to PR6f) | none yet | re-derived by engine at runtime |

## Issue codes (PR3)

Both validators (folder and stream) refuse a prepared part with its own code, and name every failing part in one
refusal (PR5):

| Part | Code |
|---|---|
| `cook.json` inputHash, fence, programs mount | `preparation-invalid` |
| `cook.json` itself and its mounts | `cook-invalid` |
| `sim/runtime-plan`, `server/native-assembly.json` and every other section | `section-invalid`, naming the section |
| Terrain, mesh-collision and navigation blobs | `blob-invalid` or `server-file-invalid` |

`validation.json` is a cache hint, not a gate: a receipt from another validator revision, or a malformed one, is
ignored and the file is checked in full (`readValidationReceipt`), so it never refuses an upload.

## The engine-coupled three (decide before PR3)

The fence, the programs and the renderer fingerprint are recorded by running an engine build, so a file prepared on
engine N names N. This is the cause J487 removes (41 of 105 failed publishes 11-14 to 11-21 were the prepare step).
The spec takes this position, reversible until PR4 ships:

- **Fence: computed from the shard alone.** The fence becomes a rule over the index, not a recording: the
  `critical` files, the spawn tile and its neighbours within the near radius, and every file those name, by hash,
  sorted. Any engine computes the same list from the same file. Until the rule ships, the recorded fence stays valid
  and is checked as today (`fenceValid`).
- **Programs: engine output, not preparation.** Linked GLSL pairs are shader warm-up for one renderer. They leave
  the uploaded file and become cook output keyed by engine build (the box records them, SP1b's machinery), so an
  engine bump never refuses or re-prepares an upload for them. A file that carries programs keeps loading; the cook
  ignores programs whose build it does not match.
- **Renderer fingerprint: dropped from preparation.** With programs out and the fence a rule, nothing in the file
  depends on the renderer. `inputHash` stops binding `renderer` at the next preparation spec version.

## Sections

### `cook.json` mounts

The shard's own files that its sections and boot tables name by public URL. Each row is `{url, path, hash, bytes}`:
the bytes sit under `mounts/` (or in the listed blob they equal) and the cook publishes each at its `url`. Computed by
the build from the sections that name URLs. Read by the cook (`shardCook.ts`, loose mounts). Checked by
`CookDataSchema`: paths at most 240 characters, URLs `^(/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*)+$`, at most 8192 rows.

### `cook.json` fence

The stable identities (file hashes) the boot reads before the player has control; `packs: 'fence'` packs exactly
these into the first pack, `'whole'` packs the level. Each hash must name a file in the index, a mount or a required
common (`fenceValid`), unique, at most 8192. Today it is recorded from a cold boot; see the decision above.

**The fence rule's radius (PR2, 11-22).** The rule uses the engine's own near ring, so any engine computes the same
set. In the spawn cell's local frame (the cell centred on the origin, metres, XZ only), take the spawn point `(x, z)`.
For each L0 tile (side `CONTENT_CAPS.l0.size`, 62.5 m, laid from the cell's `-width/2, -depth/2` corner), its
distance is from the spawn to the nearest point of the tile's rectangle: `dx = max(minX - x, 0, x - maxX)`, the same
for `dz`, and `d = hypot(dx, dz)` (0 inside the tile). The tile is in the fence when `d <= CONTENT_CAPS.nearRadius`
(150 m, `src/format/contentBounds.ts`). L1 tiles (125 m) are in when `d <= 400` m, the streamer's L1 ring. The fence
is then the hashes of the index's `critical` files, of every file those tiles' rows name, and of each file those
files name, unique and sorted. This is the streamer's first ring at spawn (engine
`src/client/engine/world/tileStreamer.ts`, `L0_RADIUS`, `L1_RADIUS`), so a boot reads nothing outside it before
control. Worked check: a spawn at the centre of a 500 m cell takes 32 L0 tiles, the 6 x 6 block from -187.5 m to
187.5 m on each axis less its 4 corner tiles, whose nearest corner sits at `hypot(125, 125)`, about 177 m.

### `cook.json` programs

`{version: 2, build, lines, shaders, programs}`: deduplicated GLSL source lines, each shader a list of line indexes,
each program a `[vertex, fragment]` pair of shader indexes, at most 512 programs, 2048 shaders, 2 MiB of source.
`build` names the engine build that recorded them. Mounted at `/programs/<slug>.json` for the client's warm-up. See
the decision above: these move to cook output.

### `cook.json` inputHash and renderer

`inputHash` is the SHA-256 of `validationSourceBytes({index without cook, mounts, renderer})`: it binds the
preparation to the exact index it was made for, so a changed index is stale preparation. `renderer` is the engine's
renderer fingerprint (`scripts/renderer-revision.mjs` in engine); the cook compares it to its own and calls the
preparation current, stale or none.

### `validation.json`

The build's receipt: `revision` (the validator revision that wrote it), `sourceHash` (SHA-256 of `shard.json`),
`indexHash`, `worst` (the worst content cost, `worstContentCost`), `residentBytes` and `postCost`. Computed by this
package's validator on the author's machine. Read by the cook (`cookJob.ts`, which recomputes `sourceHash`) and by a
page's build stamp. Format code computes every number, so it is engine agnostic.

### `sim/runtime-plan` baked pieces

The collider pieces and recipe the server's simulation installs. Computed by the build's bake from the shard's props
and terrain. Read by the MMO server (`host/headlessRuntime.ts`, `game/plugin/simulation.ts`); the engine only
installs them in its physics.

### `server/native-assembly.json`

The native client plan's bake rows, ground heights and colliders, listed in `admission.server`. Read by the MMO
server (`game/shardfile/nativeAssembly.ts`).

### Terrain, mesh-collision and navigation blobs

`terrain.collider` tiles (height lattices), `meshCollision` tiles and the `navigation.file` navmesh. Computed by the
bake. The server decodes them with this package's readers (`decodeTerrainTile`, `terrainTileHeight`) and engine's
`readNavmesh`.

### Hero card

The discovery mount's `data.card`, else `manifest.card`, else `presentation.card`: the image the catalogue shows.
Read by the API's hero gate (`api-server/src/server/shardfile/hero-gate.ts`), which reads the image's own header
for its size.

## Planned sections (PR6)

Values the engine re-derives from shard data today; each gets a section here and a schema when it moves into
preparation:

- **PR6a** creature hit volumes, sockets and giant height (from the rig GLB);
- **PR6b** prop, mesh and vehicle collider shapes;
- **PR6c** arena seal solids, play area and fall floor;
- **PR6d** the server's read set (which files the server needs);
- **PR6e** the entry read set per tier;
- **PR6f** road strip edges.
