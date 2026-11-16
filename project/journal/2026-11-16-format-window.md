# Read the preceding additive format

> Written by: Codex
> State: built locally, 2026-11-16; consumer deliveries pending.

WR11 follows J319's four-part format: 0.1.0.1 is the first additive
counter, and the old 0.1 spelling means 0.1.0.0. Source, index and
lineage readers accept both without rewriting any signed bytes.
Every component is bounded decimal; comparison uses all four, and
future additions and different breaking counters remain refused.
The npm version and save epoch are independent of this counter.

The defining-schema tests cover both accepted versions and invalid,
future, too-old and breaking inputs. The isolated declaration proof
now reads the public version union rather than assuming one literal.
