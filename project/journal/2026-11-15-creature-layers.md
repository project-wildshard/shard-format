# Add the species layers without defaulting old rows

> Written by: Codex
> State: built locally, 2026-11-15; M1 release pending.

Species rows can now state body, temperament, senses, abilities, presentation
and a type label. Exact optional fields keep every older species byte-identical
when its parsed species list is serialized. Strike and look references are
validated at the same boundary as existing row references, with named errors.

The layer module exports bounded schemas and small declared types. The old
inline species type becomes SpeciesRow, so consumers keep the existing fields
without repeating all the new layer shapes in their declarations. Hunt tuning
reuses the existing schema rather than introducing another interpretation of
its numbers. Sound names preserve existing underscore names.

This adds a contract, not new creature assets or an engine resolver. Those
have their own M1 rows. Public exports were consolidated, lowering three
existing lint counters without raising any counter. Focused behavior and
defining-declaration tests cover the new fields and retained consumer types.

The corpus proof compared the species entries from the parser at 87f98f1
with the new parser: all three Brasscap corpus species and the handwritten
species serialized identically. Both complete folders validated with zero
warnings (35 sections / 161 assets and 36 sections / 130 assets), and both
recorded corpus JSON identities stayed unchanged. The old parser module was
read from Git into owned scratch and removed after the comparison.

The kit's pursuit preset exposed an overly narrow tuning field: an open
brain name cannot require only hunt numbers. The additive contract now also
accepts bounded brain parameters, and the exact existing Template pursuit
numbers round-trip in a focused case. The engine brain remains responsible
for the semantics of its parameters; no additional brain mechanism is added.
