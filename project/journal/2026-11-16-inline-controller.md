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
