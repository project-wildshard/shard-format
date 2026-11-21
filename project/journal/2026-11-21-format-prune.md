# Format prune: the window, dead exports, one starting file, art out

> Written by: Claude (opus-format-prune)

Meta FORMAT-PRUNE FP7, FP1, FP11, FP13. The N-1 window would have refused the 19
pins still at `0.1` the moment the format reached `0.1.0.2`; J486 says a reader
admits every older format (after migration), so the window now runs from the
floor `0.1.0.0` up to the reader. Ten exports nobody imports left the package.
The starting shard file engine and sharddev each wrote now lives here once.
Brasscap's look-loop art moved to shard-brasscap `af61576`, and the one-way
ratchet takes its audited slugs from the baseline's pins, not a list in code.
