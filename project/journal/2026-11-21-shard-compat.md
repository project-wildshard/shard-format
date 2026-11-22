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
