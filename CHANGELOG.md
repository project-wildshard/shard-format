# shard-format changelog

Every release has a section here before it is tagged: one to five bullets in plain language, for shard authors and
Jake, never commit subjects. Add the next version's section at the top, commit and push it, then release as
docs/dev.md says.

## v0.4.9 (2026-11-13)

- A shard's named place sets (`world.sets` and `world.bind-sets`) now count as view-only: they list placed models for
  the sets explorer and need nothing from the server. A place's gameplay, like respawn and discovery, still comes from
  `quest.world` and `quest.reference`, so Nine Dragon, whose places use named sets alone, no longer asks the server
  for a places installer it never needed.

## v0.4.8 (2026-11-13)

- Every audio file under `/assets/music` or `/assets/sfx` now counts toward the shard's audio budget, not only `.m4a`
  and `.wav`: a `.flac`, `.aiff` or `.mp3` counts, in any letter case, and so does any file whose bytes are audio,
  whatever its name. A file that isn't audio, like `music.json`, still doesn't.
- Those newly counted files can push a shard past the budget lines: AMBER over 6 MB, red over 10 MB.
- A new red code, `audio-container`, names audio the format check can't read: FLAC, AIFF, Ogg, MP3, WebM, CAF or bytes
  in no known container. Upload refuses a shard with one, so a stray `.flac` or `.mp3` that uploaded on v0.4.7 is
  refused now. Ship AAC-LC in `.m4a`, as docs/audio.md says.

## v0.4.7 (2026-11-13)

- The shard grid is now 7×7 (49 cells), up from 5×5: the 25 placed shards keep their cells in the middle and the new
  outer ring starts empty, ready for new shards to be placed into.
- A grid may now leave cells empty; it no longer has to fill every cell. A cell beyond the 7×7 is still refused.
- `GRID_CELL_COUNT` (49) is now the most cells a grid holds, not the exact count, and `GRID_RADIUS` is 3: tools that
  sized a 5×5 from them see the bigger grid when they update.

## v0.4.6 (2026-11-13)

- Every validation refusal now carries a short, stable code (like `audio-sample-rate`) beside its message, so tools can
  match the code instead of the wording; the repo's docs/VALIDATION-CODES.md lists them all.
- A new page in the repo, docs/RUNTIME-CONTRACT.md, lists everything a shard may declare, which engine part runs it and what
  validation refuses, so you can author a shard without an engine checkout.
- A new audio guide in docs/audio.md says what audio to ship: format, bitrate, length, loudness, loops and the budget.
- Tools can import the list of engine music slots a score may play (`ENGINE_MUSIC_SLOTS` from
  `@wildshard/shard-format/engineMusic`) instead of copying it.
