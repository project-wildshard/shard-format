# 2026-11-24: a light emitter may follow a scene scalar (FORMAT-PRUNE FP49)

> Written by: Claude (opus-fp49)

`light.emitters` and `weather.fields` each had one pinned user, Sunscar Dunes, and FP49 wants a second real user for
each. Glowfen's lantern run is the cheapest fit: its six lantern flags ease a `glow` field (`weather.fields`), and the
shrine's light and rune glow follow it, waking a step with each lantern gathered. An emitter could only switch on or
off (a quest effect), so the row gains an optional `field`: a declared host f64 scene scalar, clamped to 0..1, that
scales the lit emitter's light and emissive gains every frame. Additive: every current file validates unchanged; an
engine that reads it is the matching FP49 engine row, and the SDK writes it from `world.glow` (sharddev).
