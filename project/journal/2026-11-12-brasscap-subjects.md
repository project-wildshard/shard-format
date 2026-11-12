# Brasscap Mesa: the subjects (LF2-8, opus-lf28)

> Written by: Claude (opus-lf28), 2026-11-12 ~04:45 Cancún.

- **The held lever-action** (`rifle.ts`): gloved hands in the matte primitive (no new draw): the right hand round the
  wrist with a thumb, a knuckle bar and two fingers into the lever loop, the left cupping the fore-end; a dark cuff and
  a tan duster sleeve on each wrist, running back and down out of frame. 488 triangles, 42,848 bytes. The row's
  `view.position` moves from (0.2, -0.26, -0.5) to (0.19, -0.22, -0.56) so the right hand is in frame.
- **The tin bandit** (`bandit.ts`): the eye bigger and brighter (`fff06a`) in a dark socket, standing proud of the can;
  the right arm raised forward with a revolver in its fist. 337 triangles, 72,844 bytes.
- **The Dust Wyrm** (`wyrm.ts`): an arch of eight plated terracotta segments out of a wider mound, bending over toward
  the player and sweeping across as it rises; a lighter terracotta plate rim on every joint, cream spines on its back;
  the round maw at its end facing +z (cream rim, eight teeth, a dark throat narrowing to the yellow gullet), open in every pose as the
  targets draw it; `jaw` carries the lip (the rim's lower half and the lower four teeth), so `attack.open` gapes it. Lighter colours than BM-5's, so it reads warm with the low sun behind it. Joints follow the arch
  (`neck` at spine point 3, `head` at 6, `jaw` at the rim's foot); the clips are BM-5's. 416 triangles, 75,764 bytes:
  joint indices and weights are one byte each and indices 16-bit, or the GLB passed the test's 96 KB. Height 2.10 m at
  scale 1. The test's triangle cap goes from 400 to 600.
- **Settle:** `node src/tools/brasscap/subjects.ts` runs the three generators into `corpus/sources/brasscap-mesa/`
  and swaps the changed library blobs in `corpus/brasscap-mesa/` (rows by the format's `assetCost`, library entries,
  the lever's `view.asset` and the skin looks' `skin`), moves the library budget by the change only (it also carries
  client script memory and views: a sum of the rows understates it and `pack` refuses), then `shardfile pack` and its
  settled files copied back, all on a staged copy published only once pack succeeds. A second run prints "every blob is current". Library 181,751 to 208,527 compressed.
- **The white beaten Wyrm is engine, not the GLB:** after the kill the Wyrm's material reads emissive `ffffff` at 0.9,
  `AnimalView`'s `FLASH_I`, so the hit flash never decays. Likely: `updateRagdoll` decays a custom rig's `flinch` while
  the wire row keeps its last `flinch`, so `showRow` reads a new hit (`row.flinch > this.flinch + 0.05`) every row and
  flashes again. It lands upside down too (`rotation` x pi). The same white shows on every hit in the fight. Meta
  TE-ENG9. A skin look's one family material also means no emissive part (eye, gullet): meta TE-ENG10.
- **Proof:** engine main `72da5c78` preview with this corpus over the format dependency, headless Chromium (mock
  keychain): BM-6's `bm6b-play.mjs` clears the camps, the gate drops, the Wyrm falls to 8 landed rounds, the quest
  completes; no console error. Round 1 (three iterations) in `art/look-loop/brasscap-subjects/round-1/`.
- **Codex review:** two MUSTs, fixed: the jaw owned only four teeth, so `attack.open` moved teeth and nothing else
  (the rim's lower half is on `jaw` now, a test counts it and checks every vertex's one-byte joint and weight); and
  the settle published before `pack` succeeded (it now stages). One SHOULD taken: a swapped blob that is a pack member
  stops the settle.
