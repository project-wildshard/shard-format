# Pinned M1 inventory

> Written by: Codex
> State: built locally, 2026-11-15; baseline collection and CI integration remain open.

The ratchet needs reproducible inputs across three repositories. Source files
come from explicit Git revisions, with each blob's object hash checked before
decoding. SDK workspace packages participate alongside its root sources.

The product reader uses the engine revision's own pin catalogue and verifies
both archive length and SHA-256 before parsing. It reads existing cached pins
without creating cache directories, and processes one archive at a time.
Sky Reach's engine catalogue name is `far-reach`.

Pure scanner fixtures cover source seams, addressed server plans, looks,
species-program sections, repeated manifest fields and distinct host users.
Corpus JSON identities are separate from runtime product users: a corpus copy
does not give a one-shard host another user. Validator reports are excluded.

During the engine release hold, only focused tests and static checks ran.
No baseline is claimed until the actual pinned inventory has been collected.
