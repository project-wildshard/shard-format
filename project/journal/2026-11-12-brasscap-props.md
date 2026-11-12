# Brasscap Mesa: camps, gate, cacti and the water tower (LF2-6, opus-lf26)

> Written by: Claude (opus-lf26), 2026-11-12 ~05:55 Cancún.

- **Where the detail lives:** `canyon.ts` writes it into a fourth source GLB, `props.glb` (705 KB; canyon.glb is at
  1,018,540 of 1 MiB, so no room there). The plain camps, cacti, water tower and gate sign move from `world` into
  `shell`: the far stand-in (still 7,448 triangles) and `coarse.mesas` keep them, and the bake draws the detail in the
  L0 tiles only, as `dress` (it collides) and `dress.glow` (lantern glass, tent glow, embers, flames). The gate's doors
  stay in canyon.glb's `gate.door` node, the panel field 101 hides and drops.
- **What's new:** ridge tents (panelled canvas, seams, a hem, flaps tied back, a glow inside, a lantern hung inside the
  door), stone-ringed fires with crossed logs, embers and flame tongues, X-braced crates, hooped barrels (`barrel` is
  now a top-level helper the porch shares), camp 3's wagon with a torn cover, the gate's double plank doors with straps
  and rivets, its timber frame with the GATE sign (G, T and E join `LETTERS`), a hanging lantern and the bell and lever
  on the right post, ribbed saguaros shaded by the sun, and the braced water tower. Four `look.light.pools` (the fires
  and the gate lantern). Their fixed-seed draws are `lcg(2606)`'s, so nothing earlier moves.
- **Walks:** a tent's front pole and outside lantern stopped `bm6b-play.mjs`'s standoffs at camp 2, so the tent has no
  front pole; camp 3's tent turns its door to the gate a metre off the walk in. The play script now clears camp 2 from
  the tent's north-east corner (plan-artifacts `template-e2e-v3/bm6b-play.mjs`).
- **Re-bake:** `rebake.ts` settled a swapped render-library blob (the door panel's GLB) by hand-stop before; it now
  moves the library budget by the cost difference when neither has dependencies. 235 of 235 files byte-equal.
- **Proof:** engine main `45d83bf2` preview, this corpus over the format dependency, headless with the mock keychain:
  `bm6b-play.mjs` clears the three camps, the gate drops, the Wyrm falls, the quest completes (coin chip 25) and holds
  over a reload; no console error. Rounds in `art/look-loop/brasscap-{camp-1,camp-2,camp-3,gate}/round-4/`.
- **Codex review:** two MUSTs, fixed: the lit parts drew in the L1 tiles too (now `dress.glow`), and the gate needed
  ray tests (the shut doors leave no gap a player fits through; the open gateway has nothing fixed in the walk).
