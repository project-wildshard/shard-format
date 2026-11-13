# shard-format changelog

Every release has a section here before it is tagged: one to five bullets in plain language, for shard authors and
Jake, never commit subjects. Add the next version's section at the top, commit and push it, then release as
docs/dev.md says.

## v0.4.6 (2026-11-13)

- Every validation refusal now carries a short, stable code (like `audio-sample-rate`) beside its message, so tools can
  match the code instead of the wording; the repo's docs/VALIDATION-CODES.md lists them all.
- A new page in the repo, docs/RUNTIME-CONTRACT.md, lists everything a shard may declare, which engine part runs it and what
  validation refuses, so you can author a shard without an engine checkout.
- A new audio guide in docs/audio.md says what audio to ship: format, bitrate, length, loudness, loops and the budget.
- Tools can import the list of engine music slots a score may play (`ENGINE_MUSIC_SLOTS` from
  `@wildshard/shard-format/engineMusic`) instead of copying it.
