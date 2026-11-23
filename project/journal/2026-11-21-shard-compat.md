# SHARD-COMPAT (J486)

- CP10, format half: memory and budget policy judges a shard file once, at
  upload. Both validators take `judged: 'stored'` for an already-admitted
  original (an API recheck, an engine pin, a cook): readability is checked
  as ever, but no memory line, stale reading or runtime target refuses it.
  Both return `policy` ({judged, epoch, armed, issues}) so the API can store
  the verdict and its rule version beside an upload. The held list stays
  until engine passes `judged: 'stored'`; then it empties.
- The first CP10 push hit the src/format ratchet (max-params, max-lines).
  Now `judged` rides the memory context and the verdict is recorded against
  the admitted shard object (a WeakMap), so no signature grows.
- CP10, the cook's half: `performanceReport` takes `judged: 'stored'`, so
  engine's `checkShardfile` warns on a stored file's own facts (memory
  lines, download budgets, stale readings) and refuses only what it measures
  on its build (script CPU and fuel).
- FE3: `shard-format corpus` validates every original the API lists, as
  stored, from the public list and download (no token); verdicts cache by
  hash and validator version.
  (The cook half landed after the corpus commit, which carries its note.)
- PR2 (J487): docs/preparation.md specifies every prepared section. The
  fence, recorded programs and renderer fingerprint are the engine-coupled
  part; the page takes the reversible position (fence by rule, programs as
  cook output, renderer out of preparation).
- PR5 first step: requireCookPreparation names every failing prepared part
  (stale inputHash, fence, programs mount) in one refusal, not the first.
- PR3: a stale or invalid cook preparation refuses `preparation-invalid` in
  both validators (was lumped into `cook-invalid`); validation.json stays
  a hint. docs/preparation.md lists each prepared part's code.
- FE5: the release job (npm-publish.yml) runs the corpus (corpus.yml, also
  nightly) before npm publish; a failure blocks unless corpus/known-failures.json
  lists it with its owner (Pine r1 to r6 under CP1 today).
- Fix: 0.68.0 listed ./migrations twice, so the chain (306ffac) shadowed the
  state migrations engine imports. ./migrations is the state module again;
  the chain is ./formatMigrations. exports-unique.test.ts guards it.
- CP10 re-arms Driftwood, Nalati, Nine Dragon and Pine at their epoch-8
  readings now Pine r10 is live and Nalati r5 is pinned. Pins and cooks
  validate judged stored, so only new uploads meet the armed lines.

## C6: the push gate refuses a duplicate exports key (opus-compat-w2)

`pnpm check`, which pre-push runs, now runs `src/ci/exports-unique.test.ts` (opus-compat-w1's test for
0.68.0's doubled `./migrations`); it ran only in hosted CI's test:ci before.

## FE1: the format lock (opus-compat-w2, finished by opus-compat-w3)

The format lock, `src/format/lock/`, records every package export: a valibot
schema node by node (one row per node, so one `maxLength` change moves one
row), plain data constants as rows, functions excluded with the reason,
predicates and getters by a hash of their code, and the chain id over the
migration sources with comments stripped. `pnpm lock:write` rewrites it;
`pnpm check:lock` (in `pnpm check`, so pre-push) refuses a stale one and
names the files that moved. It was one 3.67 MB file; the pre-commit caps a
blob at 1 MB, so it is a folder now: `index.json` (chain id, exclusions) and
one `<subpath>.json` per export (largest `audio.json`, 215 KB; 3.3 MB in
all, after dropping each node's constant `kind: schema` and default
`async: false`). A test fails if any file passes 512 KB. One row per line;
kept out of the npm package (`!src/format/lock/**`) and the src/format
format ratchet (generated, like ratchet.json). Keys sort by code unit, not
locale, so CI and the Mac write the same bytes. FE2's classifier reads it.

## FE2: format-diff (opus-compat-w3)

`shard-format format-diff <a> <b> [--json]` reads two format locks (a git
ref, or a folder holding `src/format/lock`) and sorts every change into
additive, deprecation, breaking or review, with `rename?` pairs and an FE8
op (drop, fill, map, rename, renameKind, moveSection). Before comparing, it
resolves `ref` rows into full subtrees, drops `expects` (derived text),
folds wrappers into the node they wrap and keys variant options by their
literal, so sharing a schema, making a field optional or inserting a
variant option moves one row, not hundreds. Only the topmost added or
removed path is reported. The lock now also carries FE7's deprecation table
(`./deprecations#<id>`), so a new deprecation is its own change. 36 seeded
kinds tested. By hand, v0.65.0 to v0.66.0 (locks built in a tmp checkout of
each tag): 17 changes, all additive, which matches the release (optional
boss decision/body, level audio, hunt/species, vehicle docks, page-start
words optional in the manifest).

## FE4: the format gate (opus-compat-w3)

`pnpm check:format-gate`, in `pnpm check` (pre-push and CI), locks the
newest release tag this tree contains with this tree's lock tool (in
./tmp/format-gate, removed after), diffs it against the tree's lock (FE2)
and refuses any breaking or review change that
`src/format/breaks/<format version>.json` does not name: a migration id
(FE8 chain), a deprecation id (FE7) or `noFileChange` with the reason. A
migration or deprecation also needs the format version to rise above the
tag's and a `corpus/format-versions/<version>/` fixture. Additive and
deprecation changes pass. First run against v0.69.1: the two CP10 re-arm
rows (ARMED_ZONES, memory-armed.json), named noFileChange in
breaks/0.1.0.2.json. About 5 s.

## FE13: the delete gate, kept-originals half (opus-compat-w3)

The lock now carries FE8's chain steps (`./format-chain#<id>`) beside
FE7's deprecations, so FE2 sees a deleted step or deprecation as
`deletes ... (FE13 gate)`. The format gate refuses such a deletion unless
`corpus/usage.json` (`pnpm corpus:usage`, which is `shard-format corpus
--usage`) is under 24 hours old and lists no kept original using it; it
names the users otherwise. A deletion needs no break-file entry. Left: the
shard repo pins half (a repo pinned to an SDK that still writes the part).

## CP17: the re-upload tool (opus-compat-w3, 11-22)

`pnpm reupload <deprecation id>` plans, per shard whose newest kept
revision uses the part: the API migrates it (the deprecation names a
chain step), its first-party repo re-publishes it (`corpus/first-party.json`
maps slug to repo; `publish.yml`, staging, version auto), or it gets a
needs-author note. `--apply --preparation <release>` dispatches every
first-party re-publish at once, polls the API for each new revision and
counts again. Older revisions still count in FE7's kept total until
CP12's daily prune takes them, so the report gives both counts. A dry
run on `requires.sdk` lists 33 shards: writers still source it, so the
apply waits for sharddev to stop writing it (CP8's drop).

## FE6: format-diff range mode (opus-compat-w3, 11-22)

`shard-format format-diff <a>..<b>` locks the range's two ends and every
commit between that touched `src/format/lock`, diffs each against the one
before it, then the ends: the net delta. A part added and removed inside
the range shows in its steps and not in the net. Refs from before FE1's
lock (v0.69.1 and older) still need a folder built with `pnpm lock:write`.

## FE13 pins half, FE3 timing (opus-compat-w3, 11-22)

`corpus --pins <file|url>` reads engine's `test/pins/shardfiles.json`;
a pinned original the public list leaves out joins the run, and usage
names every pinned user "(engine pin)" and records `pins`. The delete
gate refuses a usage record without `pins`. `pnpm corpus:usage` reads
engine main's pins. Run 11-22: 88 kept originals, 26 pins, all already
kept; 88 valid.

FE3 timing, 11-22 on the MacBook: cold run 240 s (88 originals,
3,436,128,801 stored bytes fetched); warm run 1 s (88 from cache).
