# Open item identities in the source inventory

> Written by: Codex
> State: built locally, 2026-11-16; ONE-FORMAT OF31e1.

The active engine Inventory already accepts catalogue-defined string ids.
Counting that open alias as a fixed kind vocabulary gives a false table
count. Exclude the explicit string alias while retaining restricted item
vocabularies and the independent harvest/glyph counters.

The new control fails before the fix. It then proves both that an open
identity counts zero and that reintroducing a fixed union counts one and
fails countRises. Existing planted-growth and pinned inventory proofs
remain intact. The immutable baseline engine df155405 uses a real literal
union, so its ceiling stays unchanged; this does not relax that bound.

The current source still has one engine HARVEST table and one format
legacy glyph enum. Neither is removed or hidden here. Their existing
publication/pin prerequisites remain open and kit publication needs Jake.

The commit hook completed its work in 9.0 seconds under the concurrent
engine preflight, above its eight-second timing budget. J381 permits
SKIP_BUDGET=1 for this loaded-machine retry; only the clock threshold is
skipped. The actual checks and normal pre-push/hosted gates remain on.
