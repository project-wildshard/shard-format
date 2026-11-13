# 2026-11-12 audio rules (AUDIO AU5)

- meta AUDIO-PLAN AU5 (J299): shardfile owns the audio rules. New
  `audio-measure.ts` (+ `audio-mp4.ts`) reads bitrate, channels, rate and
  duration from the m4a boxes, no ffmpeg; `audio-rules.ts` judges them;
  `audio-waiver.ts` is the dated waiver; `product-audio.ts` collects a
  validated product's own recordings (audio mounts and non-commons
  `audio.recordings`) and builds the report.
- Caps: music 64/48 kbps stereo/mono, sfx 48/40, +10% slack, 180 s.
  Budget: AMBER over 4 MB, red over 8 MB. Only red refuses, at upload
  (`assertAudioAdmission`); pack prints every finding as AMBER.
- Bitrate is AMBER, not red: every live shard is at about 97 kbps until
  AU7 encodes and AU9 to AU12 re-encode, and a red would block them all.
- Surprise: six of Pine Hollow's beds have no `edts`, so the strict
  playback index refuses them though ffprobe calls them AAC-LC 48 kHz.
  A plain box walk measures those (channels from the esds config: their
  sample entry says stereo, the config says mono) and flags them AMBER.
- Measured against the real shard sources the numbers match the plan:
  Pine 14.66 MB, Nalati 8.66, Nine Dragon 4.28, Driftwood 2.49.
- Waiver: `src/shards/<folder>/audio-waiver.json` in a shard repo, carried
  by sharddev's build to `admission.audioWaiver` in `shard.json`.
