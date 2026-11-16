# Enforce the M1 ceilings

> Written by: Codex
> State: built locally, 2026-11-15; milestone land remains pending.

The normal Node test discovery now runs the complete inventory comparison.
CI reads the source ids from the checked-in baseline and checks out those
exact snapshots into owned lane scratch. No engine build or install is
needed: the scanner reads immutable Git blobs and the engine's hashed pins.
Local worktrees locate sibling repositories through the common Git directory.
Explicit source-root/revision environment variables support branch proofs.

Two real temporary Git fixtures plant another manifest pointer and a retired
word in a document. Each changes only its own counter and fails the same
ceiling assertion. The ordinary pinned comparison passes. Source and archive
identity checks refuse malformed pins before they can change the inventory.

This freezes an audit input deliberately: a source-pin update must record
the product identities, and cannot raise a counter's ceiling. Later M1 rows
must advance the source ids to their completed branch commits before land.
