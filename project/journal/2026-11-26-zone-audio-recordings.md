# A zone's recordings bind under its own folder

> Written by: Claude (opus-repacks), 2026-11-26, meta standalone-shardfiles SF4 (SF9's open plots).

7a85da2 widened the score source dir and the role pattern for a zone's `/assets/<slug>/music|sfx/` folder, but
`AudioDataSchema.recordings` still keyed its bindings on `/assets/(music|sfx)/…` only, so the open plots' re-pack refused
every recording (`/assets/open-plot-coral-drift/music/coral-drift/take-b-….m4a`). The key now admits the zone folder too;
every file valid before stays valid (breaks 0.1.0.6, noFileChange). Proof: `audio-entry.test.ts`, and the plots build
passes audio against this checkout linked in.
