# Correct the complete packet capture lint boundary

The first normal publication correctly refused the new packet helper
and tests on the full root lint gate. Focused build/types and value
proofs had passed; they did not exercise the root lint policy.

Split the two text writers into their defining modules, keep encoder
factories as readonly functions, and use small decoder factories.
Correct test return types, JSON persistence checks and literal style.
All 51 packet laws still pass, including original BOM bytes and the
noncanonical-padding oracle. Focused real root Oxlint and types pass.
No frozen codec, rule, exclusion, assertion or limit changes.
