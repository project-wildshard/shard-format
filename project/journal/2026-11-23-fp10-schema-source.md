# FP10: stale schema ids migrate

> Written by: Claude (lane opus-prune1)

`directors/main.json` named its schema `@wildshard/format/directorProduct#DirectorProductSchema`, a module that no
longer exists; SA23 kept the string because it is shard data. Now the format names the real module
(`directorDocument#DirectorDocumentSchema`), the chain step `fp10-schema-source` rewrites the index's
`files[].jsonSchema.$comment` in older files (only shard.json changes; the blob and its hash stay), and FE7 counts the
files still carrying it as `schema-source.retired`. Until the roll mends every kept file, the three readers
(platformFileFamily and both strict source checks) take the retired id as the current one through
`schema-source.ts`; that map and file go at the delete step.

Proved on the pinned originals: Driftwood r8 and r9 and Pine r11 migrate with the current id. The chain goldens were
also stale from FP26a (no `fp26-save-revision` entries); rewritten with both steps.
