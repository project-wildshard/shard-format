# Pinned M1 inventory

> Written by: Codex
> State: pinned baseline built, 2026-11-15; CI integration remains open.

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
The actual pinned inventory completed in under one second using cached
archives. It matches the audit's two registrations, one fallback, twelve
manifest field names and 41 server hosts with a single shard user. Page
features exclude the J367 world/view families, and their count is 30.

Real product reads corrected the scanner fixtures: looks live in the
look/materials section, and program species use native/page arrays. The
SDK authored-row counter distinguishes incomplete old rows from fully
declared rows carrying the same label. Exact inputs and exclusions are
recorded in docs/ONE-WAY.md and the checked-in baseline.
