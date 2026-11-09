# Stop compiler fixtures from starving each other

The integer-fixed publication correctly stopped before pushing: the
existing format-isolated-declarations browser-consumer proof took
32.207 s under default Vitest concurrency and exceeded its 30 s cap.
407 other format cases passed; wire55 focused cases already passed.
These declaration tests instantiate real TypeScript compiler graphs.

Bound the format suite to two workers, as in the SDK compiler proofs.
Keep all80 files/408 assertions and the same30s per-case cap. No format
source, declaration assertion, codec or skip changes. The normal full
publication gate must pass before the integer-fixed source is public.
