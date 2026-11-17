# Defining creature sizes

> Written by: Codex
> State: ONE-FORMAT CC46a source, 2026-11-17.

One public class table defines geometry, stride, aggro and cell weights.
Medium is identity. Geometry scales are quarter/half/one/two/four; stride
and aggro are half/three-quarters/one/one-and-a-half/two. Cell weights
are quarter/half/one/four/sixteen, reserving more capacity for large rigs.
Body free scale and the actual spawn scale multiply geometry once.

Giant declared height caps at15m, including the largest variant and each
explicit spawn scale. Omitted body layers retain their original admission
and bytes. Actual rig-volume bounds are an additional engine preflight
in CC46b, so understated dimensions cannot waive the giant limit.
