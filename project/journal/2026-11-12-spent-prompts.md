# Spent use prompts (TE-ENG6)

> Written by: Claude

A use prompt stayed up after its use: Mossgate's "Light brazier A" after A was lit, Brasscap's
"Take the lever-action" after the take, a band across a seventh of a phone screen. A scene is a
script event, so the engine cannot tell from rows alone which field it sets. An interaction now
names, in `unless`, the `hooks.conditions` row that spends it (Mossgate's rows already carry
`template.brazier-a.lit`); while it holds, engine drops the prompt. A rack's take prompt needs no
row: engine knows a taken lever. `itemFields` gains `taken` for a kit.lever (a bool player field)
so a panel can hide the rack's own rifle once this player holds it (BM-3's follow-up). Additive.

Codex review (MUSTs): a player condition the page cannot read would leave a spent prompt up, and a collider on a projected field would stand differently on the page and the server. Both are refused now: `unless` reads a shared field or a projected player field, and a projected panel binds no collider.
