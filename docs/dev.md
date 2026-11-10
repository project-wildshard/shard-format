# Developing shardfile

Living doc: commands, layout, code rules and git hooks. AGENTS.md links
here; what the repo does is `docs/prd.md`, how it is built
`docs/design.md`.

## Commands

Run from the repo root.

- `pnpm install`: installs deps and points `core.hooksPath` at
  `.githooks/`, through `pnpm:devPreinstall`, which runs only in this
  repo. Never use `prepare` here: pnpm then builds the git dependency in
  every consumer, and pnpm 10.26+ refuses that unless the consumer
  allowlists it.
- `pnpm check:wire`: the separate `packages/wire` syntax/type checks and
  packed-consumer tests. Also runs in pre-push through `pnpm check`, and
  in its own CI job. `wire check` is an empty scaffold until WS2.
- `pnpm check`: typecheck + lint + the src/format ratchet + format:check
  + unit tests + format's tests + asks. The pre-push hook and CI run it.
- `pnpm typecheck`: `src/tsconfig.json` (CLI, tools, tests),
  `src/format/tsconfig.json` (format and its tests, Node types) and
  `src/format/tsconfig.lib.json` (the library alone: ES2022, no Node,
  no DOM).
- `pnpm test`: `node:test` on every `*.test.ts` outside `src/format`,
  run as .ts by Node's type stripping.
- `pnpm test:format`: format's imported vitest tests (D31).
- `pnpm test:ci`: `src/ci`, outer-edge tests: Template 2 through the
  real CLI, hostile uploads, a packed install. CI only, never a hook
  (J186).
- `pnpm lint:format`: the src/format ratchet (D29). `pnpm lint:format
  update` lowers the baseline after a fix; it refuses any rise.
- `pnpm test:hooks`: the `.githooks/` suite (CI, and pre-commit when
  hooks change).
- `pnpm lint:fix` / `pnpm format`: the hooks only check; these fix.
- `node src/cli/main.ts --help`: the CLI without installing it.
- `node src/cli/main.ts validate <dir|tar>`: validate a built product,
  a folder or a tarball.
- `node src/cli/main.ts pack <dir> [--out <file>]`: tar a folder. What
  its sections measure follows them, so edit a section and pack.
- `pnpm md:wrap`: rewraps Markdown prose to ~72 columns.
- `src/scripts/ask-new.sh "<Jake's words>"`: opens an ask
  (`docs/tasks/asks/README.md`).

## Wire package workspace

`packages/wire` is `@wildshard/wire`, a separate package beside the root
`@wildshard/format`. It ships plain JavaScript so installed consumers
need no type-strip hook. Its source and tests have their own strict
typecheck. The root format exports, runtime files and dependency targets
stay intact. CI installs the exact Git subdirectory into engine and
api-server:
`github:project-wildshard/shardfile#<full-sha>&path:/packages/wire`.

## Changing the format

This repo is the source of truth for `@wildshard/format`. Singleplayer
deleted its `src/format` when it switched to `v0.2.0` (MOVES.md step 7),
which ended J81. Nothing edits format anywhere else.

1. Change `src/format` here, with its tests. `pnpm check`, commit, push.
2. Batch changes, then release:
   `ASSISTED_BY=Claude-Code:<model> ../leftover/src/repo-kit/release.sh vX.Y.Z`.
3. In singleplayer, set the tag in all four manifests (root, `src/game`,
   `src/sdk`, `src/commons`) and update `pnpm-lock.yaml` with pnpm
   10.34.9 or newer. An older pnpm can record the annotated tag's object
   id instead of its commit (10.21 and 10.26.0 both do), and an install
   from an empty store then fails with `ERR_PNPM_GIT_CHECKOUT_FAILED`. A
   warm store hides this locally. Check the lock's `commit:` against
   `git rev-parse vX.Y.Z^{commit}`.
4. A new module needs its entry in `exports` here before singleplayer
   can import it, and any path outside `src/format` and `src/cli` also
   needs one in `files`, or the git dependency installs without it.

## Layout

The root stays thin: README.md and AGENTS.md (humans only), CLAUDE.md
(`@AGENTS.md`), package.json, pnpm-lock.yaml, .npmrc, .gitignore,
.editorconfig, `corpus/`, `docs/`, `project/`, `src/` and the dot dirs.
Scratch goes in `tmp/<task>/` and is deleted when done.

- `src/format/`: the `@wildshard/format` package, imported from
  singleplayer; its `exports` are in the root `package.json` (D30).
  `standards/` holds the globals it may use; `ratchet.json` is the
  D29 baseline.
- `src/hook/`: `@wildshard/format/formatHook`, the strip-types hook
  every Node consumer installs before it imports format. Plain JS on
  purpose: as .ts, nothing could load it from `node_modules`.
- `corpus/handwritten/`: Template 2 (J168), JSON held by hand and baked
  blobs, with no build. Its sections are edited here and packed with
  `shardfile pack`; its blobs are frozen Blender output (J88). It ships
  in `files`, so consumers can run it. Pinned as `blender-template`.
- `src/cli/`: the `shardfile` CLI (`validate <dir|tar>`, `pack <dir>`,
  `--version`, `--help`). `bin.mjs` is the installed entry: Node won't
  strip types under `node_modules`, so it installs the format hook
  first.
- `src/tools/`: repo tooling in TypeScript (the format ratchet).
- `src/test/helpers/`: shared test helpers; `git.ts` makes real git
  repos in temp dirs, `corpus.ts` holds Template 2 for `src/ci`.
- `src/test/fixtures/`: test inputs, outside oxfmt (a product's JSON is
  canonical and hash-bound).
- `src/scripts/`: repo tooling (asks, md-wrap), plain JS.
- `docs/`: living docs. `docs/plans/` is the queue, `docs/tasks/asks/`
  the receipts.
- `project/`: history. `journal/`, `origins/` (the meta-repo plans this
  repo came from), `archive/`.

## Code rules

- TypeScript only, imports with explicit `.ts`/`.tsx` extensions.
- `src/format` is held by the D29 ratchet instead of plain `pnpm lint`:
  a new file there must be lint-clean and formatted, and a count in an
  imported file may only fall. Fixing imported code: fix, then
  `pnpm lint:format update` in the same commit.
- A module shared with other repos goes here if both already depend on
  format (J27): `tar` (the tarball, read and write), `uploadWire`,
  `gridCatalogue`, `standaloneCatalogue`.
- The library (`src/format`, not its tests) imports only `valibot`,
  `meshoptimizer/decoder` and its own modules, by relative `./x.ts`
  path, never by its package name.
- Every function has an explicit return type. `src/.oxlintrc.json`
  denies every category (D28); disable a rule only with a one-line
  reason beside it.
- Pin dependencies exactly (`.npmrc` has `save-exact=true`).
- Other Wildshard repos are git dependencies pinned by tag
  (`github:project-wildshard/<repo>#vX.Y.Z`). They are private, so CI
  reads them with the org GitHub App token.
- Tests use real things (git in temp dirs, real files and processes);
  never mock git. No LLM, `claude`, herdr or network in tests.

## Git hooks

| Hook | Checks | Bypass |
| --- | --- | --- |
| commit-msg | Conventional Commits subject ≤ 50, body ≤ 72, one `Assisted-by: AGENT:MODEL` trailer, no AI `Co-Authored-By` | `SKIP_ATTRIB=1` (human-only commit) |
| pre-commit | `main` in the main checkout (D27), staged set echo, whitespace, 1 MB cap, credentials, sh / mjs syntax, new-plan Status line, journal (D25) | `ALLOW_BRANCH=1`, `ALLOW_BIG=1`, `ALLOW_SECRET=1`, `SKIP_JOURNAL=1` |
| pre-commit | lint + format:check on staged code (src/format is skipped: the ratchet runs at push), typecheck; 8 s budget | `SKIP_BUDGET=1` (time only), `SKIP_CHECK=1` |
| pre-push | outgoing commits: size, credentials, syntax; then `pnpm check` | `ALLOW_BIG=1`, `ALLOW_SECRET=1`, `SKIP_CHECK=1` |

Bypasses are for the case they name, never for a red gate: fix the code,
not the gate.

### Wire recording integrity

`packages/wire/bench/capture/packet-replay.ts` captures the five
non-frame v0 transport streams. `preparePacket` validates byte-identical
frozen replay before returning separate encode/decode closures for
timing. Preparation preserves original BOM text; ordinary records use
the unchanged frozen BitWriter. A BOM record includes its prepared text
adapter in encode cost. Frames still require FrameTrace with actual
per-handle baselines and due results. These helpers are recording
integrity, not the four complete WS3 recordings or a benchmark result.

## Historical wire recordings

WS3 captures the frozen v0.1.2 engine at full commit
`cfd668102efcb7c10a6fb57d3021c1f3d23c37a5`. It changes only an
uncommitted encode tee in an owned scratch clone. From this repo:

```sh
node src/scripts/wire/install-capture-tee.mjs "$BASE"
python3 ~/projects/games/wildshard/engine/scripts/cpu-admission.py run --slots 2 -- \
  node --experimental-transform-types --import "$BASE/scripts/sim-node-loader.mjs" \
  src/scripts/wire/capture-walking.mjs "$BASE" "$NEW_OUTPUT"
node --test src/scripts/wire/recordings-proof.mjs
node src/scripts/wire/installer-proof.mjs "$BASE"
```

`BASE` is an owned full scratch clone at that exact commit, with its
frozen install and actual `out/sunscar-dunes` product already built.
`NEW_OUTPUT` must not exist. The installer refuses other commits,
foreign frame/helper edits, staged source edits, redirected destinations
and untracked source. It permits only the exact tee plus three generated
boot tables unused by the headless capture. The manual installer proof
uses a real sparse Git fixture sharing the owned baseline objects,
demonstrates the old staged-edit and symlink failures, and cleans only
its own temporary root. `--check` verifies without writing; the runner
requires that exact check before loading the real room. No live network
server or browser is opened.

The complete walking session lives in
`packages/wire/bench/recordings/walking/`. Its six JSON array parts and
manifest total 4,475,972 bytes; every file is under the existing 1 MB
cap, and the whole recording is under 5 MB. No hook limit or bypass
changed. Parts retain every frame, callback, word, packet and delivery
decision. The browser-compatible typed reader verifies lengths, SHA-256,
ordered complete ranges and the whole source hash, then requires all
frozen-v0 frame and packet replays to be byte-identical before returning
data. Hash-valid corrupt codec bytes still refuse. Proof cases run
explicitly in CI, outside hooks, with timeout and elapsed caps of 9.5
seconds.

A second runner, `src/scripts/wire/capture-fight.mjs`, uses the same
arguments/preflight and captures a real two-client Driftwood melee and
chat stream with command loss/recovery. The fixture begins beside an
actual living creature; it claims no journey from spawn. Its five parts
and manifest are 3,364,687 bytes. Both clients and all native resources
are disposed in finally.

`src/scripts/wire/capture-ride.mjs` records the actual Nalati camp
horse, real mount/dismount acts and command-driven steering. Its
complete parts and manifest total 2,057,162 bytes. The mounted law
reports actual stand/walk/trot; no horse flag or pose is forced after
initial placement.

`src/scripts/wire/capture-dense.mjs` creates a synthetic flat arena with
32 real native clients and 60 moving creatures, warms it for 60 ticks,
then retains 180 ticks of all traffic. It is not a live-server capacity
proof. The expanded 80.16 MB tree has lossless structural sharing across
14 explicit deflate-JSON envelopes plus manifest, totaling 1,491,667
bytes. Every file remains below 1 MB; no hook limit is raised. The older
array writer keeps its 5 MB whole-session bound. Dense has separate
explicit bounds: 5 MB stored, 1 MB decompressed per part, 100 MB
expanded canonical JSON, 500,000 nodes and depth 64. Standard browser
compression changes storage only; the frozen transport bytes stay exact.
The graph reader checks complete ordered hashes, bounded streaming
decompression and expansion size before materializing JSON, then the
same mandatory frozen byte oracle. Cycles, duplicate keys, expansion
bombs and correctly resealed corrupt codec bytes refuse.

Walking and dense captures each repeated with all committed data files
literally byte-identical. Those are reproducibility checks, not timing.
All four complete recordings are present locally. Node/4x Chromium
timing and two-run timing stability are still open. No benchmark gate or
v1 performance pass is claimed; voice control prefix 8 belongs to the
later v1 work and is not injected into this historical baseline.

## Frozen wire timing (WS3, manual only)

`pnpm bench <absolute-checkout-tmp-report.json>` runs Node and Chromium
with CDP 4x CPU throttling, exactly twice each. Run from a clean
committed checkout after `pnpm --dir packages/wire build`, with the
supported engine foreground check and browser-lane wrappers. For
this shared Mac:

```sh
WS_FULL_SUITE=1 python3 \
  ~/projects/games/wildshard/engine/scripts/heavy-lane.py \
  check --max 20 -- bash \
  ~/projects/games/wildshard/engine/scripts/browser-lane.sh \
  --max 20 pnpm bench "$PWD/tmp/wire-bench/result.json"
```

Start from a normal-priority parent with no inherited heavy lease or
background flag. The runner records actual parent/child niceness and
refuses inherited background priority before timing. Never pretend to
be a push gate to obtain its profile. The Vite library compilation makes
`check` the correct resource kind: one global full-test lease plus one
build slot. The ordinary plain full-test wrapper yields with utility
QoS and nice 10; it is not the foreground timing route.

The manual command also owns one browser slot;
no hook or ordinary CI starts it. Every browser is muted, portrait
390x844, with the shared keychain flags. The only server binds localhost
and closes with the browser in finally. No live game/socket is involved.

Walking, fight, ride and dense archives must first pass every content
hash, complete packet/reference check and frozen-v0 byte oracle,
including all per-handle rowFrom/due baselines. Input reconstruction is
outside timing. Timed framing, lookup, dispatch, masks, output copying,
allocation and writer reset stay inside. Production-sized reused writers
are 4096 down/1024 up. Lost packets are encoded but never decoded, just
as the captured receiver saw them. Every pass keeps actual packet order.

Policy is fixed before measurement: 16 warm passes, 32 complete-pass
mean samples and 32 separate per-operation p95 sample passes, at least
4096 operations. The mean uses one clock pair around an entire ordered
pass. Individual p95 samples include clock-call overhead; none is
subtracted. Per-stream sampled costs remain explicit. The browser uses
an isolated high-resolution clock and actual CDP rate 4 during codec
work. Initial parsing, bundle preparation and collection of abandoned
fixture graphs happen outside timing; normal in-run GC remains timed.

Raw per-operation samples are saved beside the compact report, with
SHA-256 references. Paired-clock resolution, zero samples and distinct
clock bins stay alongside p95; no quantisation is hidden or deducted.
All 32 existing full-pass timer values are retained, in order, without
another clock read or added measured operation. Node process counters
before/after the complete measurement call include warm-up and statistic
collection; they are context, not per-primary-clock CPU attribution.
The browser sink is exposed and consumed outside the clock intervals.

`wire-benchmark` is a manual-only hosted comparison. Dispatch with the
exact 40-character `source` SHA after its normal publication. It runs
the same harness on an isolated Linux runner, retains every red result
and raw sample as a 30-day artifact, and has a 20-minute job cap. No
deploy or secret is involved. Estimated cost is 4–6 runner-minutes;
record the actual duration rather than treating that estimate as proof.

Reports print frame-byte mean/p95, steady bytes by direction, handshake
bytes separately and maximum welcome, then encode/decode mean/p95 and
per-stream breakdowns. Node and browser each require under 3 percent
between their two actual primary mean/p95 readings; the CLI retains
both results and fails otherwise. No adaptive count, fastest-of-N or
retry exists. 4x desktop is a reproducible proxy, never a real phone.
The four cheap statistics/refusal tests run in normal wire checks;
manual timing and fixture replay remain outside hooks. Historical v0
predates voice; v1 still must route SOCKET_VOICE=8 in its separate row.
