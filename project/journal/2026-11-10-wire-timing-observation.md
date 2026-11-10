# Retain the existing full-pass clock evidence

Exact public 1cbeff7 passes its normal full hook and hosted CI. The
original complete dense admission case is 9.439 seconds against 9.5;
that is green with only 61 ms headroom, not a robust margin claim.

The first complete Node/Chromium-4x timing attempt is red at the fixed
3% rule. Its plain full-test admission applied nice 10/utility QoS.
The supported foreground counterfactual uses check, which owns global
full-test plus one actual Vite build slot. Actual parent and benchmark
child niceness are both zero. It also completes every fixed run and
remains red. Both immutable reports, all raw samples and hashes remain:
d6d8bfdc3aa6d321cece45c7ac2caf9e0f3bade9dee41ccae2f4e7ae471901ed
and 9efaa7460fd150af73d174de986602bc27f0e31e54454919ec5864be9c2499d3.
No blind repeat, timing-rule relaxation or QoS-only explanation follows.

A separate 1.64-second traced walking diagnostic includes phase markers.
There are zero V8 deoptimizations in its encode/decode mean windows,
with two/four small scavenges respectively. That single traced result
is not a qualification and does not establish the remaining root cause.

Previously the mean retained only its aggregate, losing the already
observed full-pass durations needed to investigate timing drift. Keep
those exact 32 values, including zeros, in order. No clock read, codec
call, warm pass, sample pass, packet, allocation or writer reset is
removed or moved out of its original measured window. Reporting pushes
remain after the existing closing clock. The primary mean and strict
three-percent comparator use the unchanged formula and policy.

The command also records Node process CPU, resource counters and host
load before/after the whole measurement call. These include warm-up and
statistics, so they cannot claim per-primary-clock CPU attribution.
Actual niceness is recorded and refused if it is not normal; manual
docs use the existing supported check route, never a fake push profile.

The deterministic actual-codec contract records nonuniform timer pairs
independently, then checks every retained mean value in order, zeros,
the exact original scalar and unchanged timed dispatch/order/loss laws.
Five focused checks pass in 98 ms. This is diagnostic evidence only:
both prior red attempts remain red and WS3 stays open until an actual
two-run result meets its unchanged gate. No wire codec or capture changes.
