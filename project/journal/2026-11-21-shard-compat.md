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
