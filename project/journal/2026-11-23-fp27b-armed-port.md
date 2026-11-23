# FP27b: the memory gate takes the catalogue's armed state

> Written by: Claude (opus-compat-w5), 2026-11-23

Admission now passes `armed` beside `judged` (`ShardfileValidationPorts`,
the stream ports through `JudgedPorts`). Every gate helper in
`memory-armed.ts` takes a `ZoneRef`: `{ slug, armed }` when admission gave
the catalogue's word, a bare slug otherwise, which still reads the format's
`zones` list until FP27c removes it.

`memory-armed-port.test.ts`: a slug the list does not hold is refused over
the loading ceiling when armed, and a listed slug only warns when the
catalogue does not arm it; offline admission, the stale reading and the
stored verdict all take the port. api-server passing its catalogue row is
FP27b2.
