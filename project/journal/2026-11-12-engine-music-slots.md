# A score names the engine music it plays (AUDIO AU18, J304)

> Written by: Claude

Jake, 2026-11-12 ~22:00 Cancún (J304): one music style per shard, and the shard says which engine music it uses, or
sharddev derives it. Every shard keeps piano, so the engine ships one style whose manifest has three slots: `title`,
`island` and `pine`.

The shard already says it by name. `bootSlots` holds `title`, and a slot whose set is `base` (or unset) is played from the
engine style: Driftwood's `island`, Pine's `pine`. A set-catalogue score (Nalati, Nine Dragon, the plots) plays its own
`source` beside the title. `engine-music.ts` turns those rows into the slot list, and `AudioMusicSchema` now refuses a
`base` slot the engine has no stem for. Before, the engine's selection dropped such a slot silently through `shipped`,
and the shard played synth with nobody told.

Why names and not files: engine music files carry content hashes, and AUDIO AU9's re-encode renames every one. A static
file list in pinned shard content would need a new revision of every shard on each engine re-encode. The engine cook
derives the hashed files from these names (AU18's engine half, after AU1).

Every shard source today passes: Driftwood names `island`, Pine `pine`, the rest use set catalogues.
