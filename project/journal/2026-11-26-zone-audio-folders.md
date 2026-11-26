# A zone's audio under its own slug

> Written by: Claude (opus-repacks), 2026-11-26, meta standalone-shardfiles SF4 and SF9.

A re-packed zone carries its music and sound under `/assets/<slug>/music/<key>/` and `/assets/<slug>/sfx/<key>/` (SF4),
so two zones never write the same engine-wide folder. The score schema's `source.dir` admits that shape beside the
engine-wide `/assets/music/<key>/`, and the audio measure reads both as music or sound. A slug is one lower-case
hyphenated segment; a folder two deep or in capitals is still refused. The engine reads these folders from
plan/repacks (zoneAssets.ts).
