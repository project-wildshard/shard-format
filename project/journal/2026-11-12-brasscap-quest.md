# Brasscap Mesa's quest and saves (BM-6)

> Written by: Claude (opus-bm6, 2026-11-12 ~01:45 Cancún). **State:** done.
> Meta `docs/plans/TEMPLATE-E2E-PLAN.md` row BM-6.

## What it is

- One quest, `brasscap.mesa` ("Brasscap Mesa"), with no NPC: it has no
  `startWhen`, so it starts on spawn, and its chip leads from the first
  frame. Steps: `rifle`, `camp-1`, `camp-2`, `camp-3`, `wyrm`.
- **Rifle.** The lever-action's `taken` state is an owned line for its
  holder (engine `declaredKitItems.ts`), not a flag a quest can read, so
  the step is done by any kill: a target post, a bandit or the Wyrm. The
  rack's rifle is the only weapon, so a kill proves it was taken. Its
  objective says so: take it and try it on a target.
- **Camps.** BM-4's three steps, unchanged, with their markers: each is
  done on engine's `dead:<spawn id>` flags for its own camp's bodies.
- **Wyrm.** Done on `dead:dust-wyrm` (engine `sim.ts` raises it at the
  death; declared in `flags`), as MH-5's note advises for the Warden.
- **Pay.** `onComplete`: 25 coins and the ledger fact `brasscap.mesa`. A
  ledger rule (Template 1's shape) turns the fact into the achievement
  "Tamer of the mesa". A coin loot row (`brasscap.loot`, gear
  `purse.coins`) turns on the page's coin chip: engine `clientSource.ts`
  sets `loot.coins` only when a shard has a loot row.
- **The gate keeps BM-4's hook** as its own quest, `brasscap.gate`, with
  `track: false` (no chip, no pins): one step done when all nine bandits
  are down, `completeFlag` `brasscap.gate.open`, and the `onComplete`
  scene that sets shared field 101. It has to be a second quest: a scene
  runs only from a quest's completion or a dialogue choice, and the gate
  opens mid-quest, before the Wyrm.
- The rows came from a throwaway script that reads the committed camp
  steps, so it applies over any camp positions; the corpus was then
  `shardfile pack`ed and its settled `shard.json` and `validation.json`
  copied back. Tests: `src/ci/brasscap-quest.test.ts`, and
  `src/ci/brasscap-bandits.test.ts` now finds quests by id.

## Proof

- An engine preview (`3be630ff`, this corpus over the format dependency,
  `pins.ts install --from-format brasscap-mesa`, a catalogue listing
  Brasscap), headless Chromium with `--use-mock-keychain
  --password-store=basic`. The chip reads Rifle at spawn; one round on a
  target post moves it to Camp 1 (0/3); the camps advance it (Camp 2,
  Camp 3) and the third camp's last bandit opens the gate (panel hidden,
  collider not solid); the walk goes through to z = -83; the Wyrm falls
  to 8 landed rounds in its windows; "Quest complete: Brasscap Mesa",
  the coin chip reads 25, and the profile ledger holds the fact
  `brasscap.mesa` (`quest.complete`) and the earned achievement.
- After the 30 s autosave, a reload resumes with the gate open, the
  flags `dead:dust-wyrm` and `brasscap.mesa.done`, no chip, 25 coins and
  the ledger unchanged. No console errors, nothing off the machine. Shot
  `progress/t2-09-quest.jpg`.

- Re-proved on the current canyon (opus-bm6b, 2026-11-12 ~03:58 Cancún,
  engine `3e4352be`, this corpus over `b285b2d`'s LF2-4 mesas): the
  three camps cleared on foot, the gate dropped, the Wyrm fell to 8 landed
  rounds, the coin chip read 25, the save held the fact `brasscap.mesa`
  and the earned achievement, and a reload after the autosave kept the
  gate open and `brasscap.mesa.done`. No console errors. The walk from
  camp 3 to the gate now goes by (13.5, -52.5): LF2-4's dressing stops a
  straight line.

## Not done (engine)

- On a reload, both quests' "Quest complete" cards play again, on top
  of each other. A presentation's `alreadyComplete` is read at install,
  before the server's flags reach a wire page.
- A reload within 30 s of a kill can lose it: the page saves every 30 s
  and on `pagehide`, and a reload doesn't wait for the `pagehide` save.
- The Wyrm's pin and nameplate ("Dust Wyrm · 11 m") stay up for a
  moment after the kill.
