# The one-way ratchet reads today's mains

> Written by: Claude (opus-prune2), 2026-11-24.

FORMAT-PRUNE FP42: `engine.kind-literals` reached 28 over its 24 ceiling and CI stayed
green, because `one-way.test.ts` read the frozen M1 engine and SDK revisions and the
eight M1 pins. It now reads each sibling's fetched `origin/main` (CI checks out both
mains) and every engine pin, so the kinds it knows are today's. The baseline keeps only
the ceilings and the corpus digests, and every ceiling drops to today's count:
kind-literals 10 after the engine stopped naming horse in cooked taming and its doc
examples. A new drill plants a kind literal on a fixture's newest main.

FP46 in the same push: the retired shard words leave the re-upload tools
(`corpus/first-party.json` is now `corpus/shard-repos.json`) and `docs/dev.md`; a chain
step's or deprecation's test names the old trust value it rewrites, so it is skipped
like the step itself. FP45 took the SDK's old-kind rows to 0. Those three counters'
ceilings are 0.

The cost: a rise on engine or SDK main turns this repo's CI red, which is the point.
