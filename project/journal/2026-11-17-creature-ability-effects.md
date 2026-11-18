# Admit creature knockback and tells

> Written by: Codex
> State: verified locally, 2026-11-17.

An authored ability can pair a knockback effect with its horizontal
distance in metres. The warning tell is independent and reuses the
scripted strike's ring and lane kinds. Existing ability rows gain no
fields.

The ordinary row parser accepts the new 6 m example with either tell,
accepts a tell by itself, and refuses unknown effects or tells,
distance without an effect and negative or out-of-range distances.
