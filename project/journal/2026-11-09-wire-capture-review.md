# Preserve valid frames across replay allocation

The J206 one-shot review found that evaluating data.set before claim
binds the old typed array when claim grows it. Claim first, then read
the new array, in capture reconstruction and the golden frame helper.
A real frozen-codec frame with 32 players and 60 creatures reproduces
the RangeError before the fix and replays identical bytes afterward.

A second old-red case has rideWords=3 without ride storage. Preserve
the count independently through capture and replay, matching the
frozen encoder's three zero words. Both new regressions now pass.

The packed consumer now really installs its tarball offline, repeats
a frozen install, and resolves valibot from the installed package's
real path. The dependency must be inside the isolated consumer, not
the parent repo or a global virtual store. CI=true also passes. It
retains CLI refusal, frozen-source mutation and lock mutation checks.

All 61 focused cases pass with strict lint/types. The prior capture
commit's four tests included two negative mutants; it did not contain
four separate mutants. The full four-session WS3 benchmark remains
open. No gameplay codec or live service changed.

Review: ~/.cache/wildshard/session-keep/reviews/
shardfile-WS2-followup-20261109T231456Z-52758.md
