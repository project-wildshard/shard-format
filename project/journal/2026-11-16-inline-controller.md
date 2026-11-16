# Admit the declared temperament owner

> Written by: Codex
> **State:** built, 2026-11-16.

The combined kit fixture exposed an old controller-count assumption:
a null spawn brain meant an encounter had to own it. M1 temperaments
also own their spawns. Admit that existing engine path while refusing
missing owners, different named owners and competing encounters.

Fifteen controller/layer controls, defining types and both lint lanes pass. The
normal SDK fixture builds and checks both original kit creatures and
an authored reskin with an empty real engine registry, using this
candidate format and the owned M1 engine. Published pins remain open.

Review found that the first rule also refused previously admitted explicit
controllers and accepted arbitrary temperament names. Preserve the old
named/encounter admission exactly; extend only null-brain bodies without an
encounter to a known engine policy or an existing individual declaration.
The exhaustive policy map is checked against the defining brain union, and
unknown names and group-only names refuse. Engine policy preparation retains
its own tuning and ownership checks. This additive format release does not
retroactively tighten those old syntax combinations.
