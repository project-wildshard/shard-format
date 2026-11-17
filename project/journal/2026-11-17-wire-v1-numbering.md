# Wire 1.0.0: the package number is the wire's, and appended row fields are a minor

> Written by: Claude (opus-wr8, WIRE-STABILITY WR8a)

MMO-PLAN MP1.5a appended two row fields to `player` (`roadX`, `roadZ`) and `wire check` refused them as a
retype and a major. Both keys it tripped on are derived: a class's `rowFields` counts its row fields, and
`v0SchemaHash` hashes today's classes in v0 text. Any append moves both, so under the old rules no released
class could ever gain a row field without a major. That contradicts the plan's own 5.4/5.5. The unit fixture
for "an append passes" never noticed, because it left both values stale. Now `rowFields` is not part of a
class's form, and `v0SchemaHash` is no longer a major key (the frozen v0 lock has its own `--baseline` check).

The package also shipped as 0.1.0 while its lock said WIRE_MAJOR 1. A minor would have had to ship as a patch,
which the patch-tag rule refuses, and the deprecation clock looks up `wire-v<major>.<minor>.0`, a tag that
didn't exist. So the package is 1.0.0 (lock byte-identical to `wire-v0.1.0`), and a test ties the number to
`WIRE_MAJOR.WIRE_MINOR`. MP1.5a ships as `wire-v1.1.0`. `docs/wire.md` is the one-page contract.
