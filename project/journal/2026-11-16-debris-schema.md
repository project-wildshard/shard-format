# Keep debris schemas convertible

> Written by: Codex
> **State:** built, 2026-11-16.

Engine M1's normal preflight found ten failures across four native schema
fixture files. New debris declarations used opaque custom validators for
both their palette and plain-JSON guard. The existing official JSON Schema
converter refuses unknown custom schemas by design.

Use the standard palette picklist and export the exact existing plain-JSON
preflight identity. Engine/SDK structural projectors can bridge only that
identity before the same strict policy parser; the guard still refuses
accessors before reading them. The complete policy structure and semantic
check identities remain. Accepted inputs and defining input types stay exact.
No caller's custom validator is granted a generic bypass.
