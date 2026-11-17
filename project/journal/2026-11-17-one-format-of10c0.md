# ONE-FORMAT OF10c0: the budget tier field (opus-of-m6b)

- `budgets.tier` (`small`, `medium`, `large`; none is `small`) in `src/format/budget-tiers.ts`, each
  a CPU (µs per 60 Hz frame), memory and bandwidth limit (large = J338's 100 MB hard cap). OF10c1
  to OF10c4 meter the engine's four dangerous gates against these, then delete them. The numbers
  are a first cut, reversible; the metering rows will tune them.
- Memory limits tuned to the measured runtimes (`runtimeAccountedBytes` of each shard's reviewed
  `runtimeCost.json`): Sky Reach 139, Pine 154, Nalati 188, Nine Dragon 325 MiB. Tiers are now
  128 / 256 / 512 MiB, so the three fit `medium` and Nine fits `large`.
