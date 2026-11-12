# Skin looks map GLB materials (TE-ENG10)

> Written by: Claude (opus-teeng10), 2026-11-12

A skinned creature drew in one family material, so Brasscap's bandit eye and
the Wyrm's gullet could only be bright vertex colour, never LF1-2's emissive
look material. `platform.skin` look rows now take an optional
`parameters.materials` (GLB material name to `look.materials` ID), the way
`props.materials` does. The skin GLB's one skinned mesh may carry up to eight
primitives (same channels); mapped names must be drawn by the GLB and every ID
declared (`src/format/skin-materials.ts`, test
`src/tools/brasscap/skin-materials.test.ts`, red before, green after). The
engine half (merge the primitives, one draw per mapped material, hit flash over
all of them) lands in engine next. Brasscap's own GLBs are still one primitive:
splitting the eye and gullet into their own GLB material is the corpus step.

Correction, same lane: the map moved from the look row's `parameters` to the
skin binding's `materials`. A look row's parameters admit only numbers, flags,
text and number lists (`rows.ts`), so `pack` refused the object a Brasscap
preview wrote; 37f272e's `parameters.materials` could never be written. The
binding is a JSON blob with its own strict schema, and is where the plan row
asked for it ("a skin binding row").

Codex review: a mapped part naming a graph look material is now refused. A
part flashes with the body through its family emissive or colour, and an
unlit graph ignores its emissive port.

## Brasscap's glow rows (opus-bmglow, ~06:55 Cancún)

- `bandit.ts` and `wyrm.ts` emit the eye box (12 triangles) and the gullet's cap (8) as a second primitive in a GLB
  material `Eye` / `Gullet`, over the same vertex accessors with its own index list; the skin bindings map them to
  the look's `glow` (`materials: { Eye: 'glow' }`, `{ Gullet: 'glow' }`). The TE-ENG10 format test now builds its
  one-part Wyrm by dropping the part, and a new case checks both generated GLBs carry the mapped part.
- `subjects.ts` swapped four blobs: library +769 bytes. Caps hold (bandit 337 triangles, 73,200 bytes; Wyrm 416,
  76,120).
