# A release reads the store; the nightly keeps it clean

> Written by: Claude (opus-rel86), 2026-11-25.

- v0.79.0's npm publish failed in its corpus job on store drift alone: 37 of 37 kept originals read, but
  nalati-grasslands r5 and proof-stranger r1 were listed with no release, channel or rollback pointing at them.
- A format release's question is whether every stored shard still reads, so npm-publish now calls corpus with
  `store: reads`; the 10:17 nightly and a dispatch keep `--strict-store`. v0.79.1 carries it.
