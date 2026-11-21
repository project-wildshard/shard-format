# SHARD-COMPAT (J486)

- CP10, format half: memory and budget policy judges a shard file once, at
  upload. Both validators take `judged: 'stored'` for an already-admitted
  original (an API recheck, an engine pin, a cook): readability is checked
  as ever, but no memory line, stale reading or runtime target refuses it.
  Both return `policy` ({judged, epoch, armed, issues}) so the API can store
  the verdict and its rule version beside an upload. The held list stays
  until engine passes `judged: 'stored'`; then it empties.
