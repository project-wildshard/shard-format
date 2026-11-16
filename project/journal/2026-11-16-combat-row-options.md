# Combat options belong to rows

> Written by: Codex
> **State:** built, 2026-11-16; ONE-FORMAT M1 OF31d1.

Gameplay species rows admit a boolean cap exemption. Look-only hull and
book metadata omit it alongside harvest gameplay data. Strike rows and
melee swings admit bounded debris defaults and overrides keyed by target
species row id, allowing two bodies with the same kind label to differ.

The existing effects owner keeps its material recipes. The format admits
only finite bounded counts, booleans and known material names; duplicate
and missing target rows refuse at catalogue admission. JSON-only policy
admission rejects callbacks and accessors before reading them.

Five real parser controls cover standalone policy, rows, older species
programs, all melee swing paths and a full assembled product. Existing
look-metadata controls additionally prove the cap flag cannot enter there.
Runtime behavior and older source publication remain OF31d2/OF31d3.
