# Species layers

> Written by: Codex
> State: M1 contract released0.14; additive M2 contracts, 2026-11-17.

A species keeps its id, kind label, variants and existing dimensions. These
fields are optional additions. Parsing an older row does not add any layer.
The type label is for quest and journal filters; it never chooses a body.

| Field | Contract |
|---|---|
| type | beast, humanoid, giant, dragonkin, undead, elemental, construct, insect, aquatic, critter or aberration |
| body | Optional kit skeleton (quadruped or biped), size (tiny to giant), positive scale up to 10, and an existing look row id |
| temperament | An open brain name, reaction (passive, skittish, neutral, aggressive), leash and assist radii, and home return speed/stop distance |
| senses | Required notice radius; optional sight range/cone/graze radius, hearing radii for still/crouch/walk/sprint, and reveal radius |
| abilities | At most 32 ordered strike references, each with range, cooldown and weight; optional health gate, damage, speed, windup and duration |
| presentation | Blood switch and sound names; optional call variants and an ordered call interval |

Temperament modifiers are pack (boolean), territorial (radius), ambush
(boolean) and flee (remaining-health fraction). Optional tuning accepts the
existing complete hunt contract, preserving stalk tuning, or a bounded brain
parameter object. Each object has at most 64 fields; values are finite numbers,
booleans, sound/id strings, up to 32 scalar values, or one scalar object.
The named engine brain validates the meaning of its own parameters.
A spawn may name a bounded `group` id for social membership. It does not
select a controller: each member keeps its own temperament brain. Pack
assistance uses this group together with the row’s pack modifier and assist
radius. Omission stays absent, including in older saved source JSON.

The spawn supplies home position. The home object supplies return speed and
the distance at which the creature has arrived; later engine rows implement
healing and resetting on return.

Distances are metres, durations seconds, speed metres per second, sight cones
radians and health gates fractions between zero and one. A scalar ability
range means zero through that radius; a pair means an inclusive ordered near
and far radius. A use name must identify a strike row in the same row set.
A body look must identify a look in that row set. The list's order is authored
priority; the parser does not reorder it or inject a default ability.

A body with its own GLB rig omits skeleton; a kit poser names its skeleton
contract explicitly. Omission remains absent and does not select a kit rig.
Unknown skeletons, reactions, sense fields, ability references and look
references produce named errors. All numbers are finite and bounded. Keeping
kind as a label does not select an engine registration. The later resolver
and SDK expansion rows decide when a new build must spell out these layers.

Import the types and field schemas from @wildshard/shard-format/creatureLayers.
RowsSchema and parseRows validate the complete row set and its references.
Corpus compatibility and release are CC1c.

## Skeleton contracts

The creatureSkeletons export supplies CREATURE_SKELETONS and skeletonBones.
Both skeletons have a body root and a head bone. The quadruped preserves
the current gait names: neck1/neck2/head, tail, front L/R shoulder/carpus/
fetlock chains, and back L/R hip/stifle/hock chains. Joint prefixes are FL,
FR, BL and BR followed by an underscore. Optional ear and belly bones may
remain on a body without becoming required by the contract.

The biped's body root has a hips/spine/chest/neck/head chain. Upper arm,
forearm and hand chains start at chest; thigh, shin and foot chains start
at hips. Their side suffix is .L or .R. The root can be an identity node;
the existing actor root contract remains available to both skeletons.

Both expose head, mouth, chest and back sockets. The quadruped also has
seat and tail; the biped has hand.L and hand.R. Lock targets the chest
socket. Socket positions are offsets in their bone's local bind frame.
Supported clip names are idle, walk, run, attack, hit and die.

Default volumes are a body capsule and a head sphere, expressed in metres
before size/scale and row overrides. The capsule radius is 0.35 and its
half length is 0.5, along z for quadrupeds and y for bipeds. Head radius is
0.3 with a damage multiplier of 2; the body multiplier is 1. CC6 applies
these contracts to server volumes and enforces the minimum 0.3 hit radius.
These are contracts only; this row adds no meshes or animation assets.

A skin rig may declare an empty `clips` list for a kit poser. The list
remains bounded to32 recognized clip names; bindings may loop only a
clip present in that list. This does not invent an idle animation or
change a GLB. Joint order, required body/head and socket admission remain
the same for animated and clipless rigs.

## The horizontal biped (ONE-FORMAT CC58)

A biped body may name a `stance`: `upright` (the plain biped, the
default) or `horizontal` (Q-CC38: the T-Rex). A horizontal biped needs a
`trail` row for its tail: `count` bones `tail1` to `tail<count>` in a
`tail` chain off the hips, `spacing` metres apart, each following the
path behind the hips like a serpent's trail bones. The contract pitches
the `spine` bone forward by `HORIZONTAL_SPINE_PITCH` (1.3 rad), adds one
capsule a tail bone at half damage and a `tail` socket on the tip, so a
sweep can start `from: tail`. Only a biped has a stance, and only a
serpent or a horizontal biped has a trail row. The contract's `trail`
lists the bones that follow the path, so posers read it rather than the
skeleton name.

## Actor channels (ONE-FORMAT CC28)

A body may declare up to four `channels`, each a name and an optional
`initial` value from 0 to 1 (0 when omitted). The server owns their values:
a script's `actorChannel` command (ABI-1 id 28) sets one by its index in this
list, and the wire carries them as animal fields 25 to 28 in the same order,
so every page reads the same value. A body's `bind` ties its look's material
to channels: `tint` and `emissive` move toward a colour as their channel goes
0 to 1, and `opacity` is a channel's value. `swap` draws a second look while
a channel is at or above `at` (0.5 when omitted); that look must exist. A
bound or swapped channel must be declared.

## Attachments (ONE-FORMAT CC30a)

A body may hang up to eight `attachments` on its sockets: a skeleton
contract's socket (`hand.R`, `chest`, a serpent's `core`), or any bone
of a GLB's own rig. Each draws one to four parts, the boss socket rig's
`{ id, geometry, material }` shape, where `geometry` is a library GLB's
hash and `material` a `look.materials` id, at an optional `at` offset in
the socket's frame. `when` shows it only while a channel is at its `at`
(0.5 when omitted) or above. `part` names a body volume that has `hp`
and a break `channel`: the break sets that channel to 1, so the part
reaches every page broken and the attachment hides. `desktop` drops it
on the phone tier. A volume's break channel must be declared.
