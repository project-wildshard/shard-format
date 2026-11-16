# Species layers

> Written by: Codex
> State: additive format contract, 2026-11-15; M1 release pending.

A species keeps its id, kind label, variants and existing dimensions. These
fields are optional additions. Parsing an older row does not add any layer.
The type label is for quest and journal filters; it never chooses a body.

| Field | Contract |
|---|---|
| type | beast, humanoid, giant, dragonkin, undead, elemental, construct, insect, aquatic, critter or aberration |
| body | skeleton (quadruped or biped), size (tiny to giant), positive scale up to 10, and an existing look row id |
| temperament | An open brain name, reaction (passive, skittish, neutral, aggressive), leash and assist radii, and home return speed/stop distance |
| senses | Required notice radius; optional sight range/cone/graze radius, hearing radii for still/crouch/walk/sprint, and reveal radius |
| abilities | At most 32 ordered strike references, each with range, cooldown and weight; optional health gate, damage, speed, windup and duration |
| presentation | Blood switch and sound names; optional call variants and an ordered call interval |

Temperament modifiers are pack (boolean), territorial (radius), ambush
(boolean) and flee (remaining-health fraction). Optional tuning is the existing
complete hunt tuning contract, preserving every number, including stalk tuning.
The spawn supplies home position. The home object supplies return speed and
the distance at which the creature has arrived; later engine rows implement
healing and resetting on return.

Distances are metres, durations seconds, speed metres per second, sight cones
radians and health gates fractions between zero and one. A scalar ability
range means zero through that radius; a pair means an inclusive ordered near
and far radius. A use name must identify a strike row in the same row set.
A body look must identify a look in that row set. The list's order is authored
priority; the parser does not reorder it or inject a default ability.

Unknown skeletons, reactions, sense fields, ability references and look
references produce named errors. All numbers are finite and bounded. Keeping
kind as a label does not select an engine registration. The later resolver
and SDK expansion rows decide when a new build must spell out these layers.

Import the types and field schemas from @wildshard/shard-format/creatureLayers.
RowsSchema and parseRows validate the complete row set and its references.
The skeleton contracts are CC1b; corpus compatibility and release are CC1c.
