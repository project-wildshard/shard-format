# The level look leaves the manifest and discovery (format 0.1.0.6)

> Written by: Claude (opus-pr6). Meta FORMAT-PRUNE FP47b, format half; for the cut after 0.75.0.

ONE-FORMAT OF9b2 moved the level look (sky, atmosphere, grade, horizon) to `look/look`'s `level`, and `liftLevelLook`
lifts an older manifest's at the door, but the discovery mount kept a copy because engine's grid shell read it before
the product admitted. Engine `577c013ef` reads `look.level` first, so the copy has no reader left.

Format 0.1.0.6 refuses the four words in the `ui/level` manifest and the discovery mount (`checkNoMovedWords`,
`checkDiscoveryMount`, reporting FP47b). Chain step `fp47b-level-look` fills `look/look`'s empty `level` from the
manifest, else from a discovery copy (the open plots, Mirror Salt and Mossgate carry theirs only there), the look's own
winning, then drops the words. Older files read and hash as written; the four deprecation rows name the step.

0.75.0 ships format 0.1.0.5 without FP34 and FP36, so this branch's 0.1.0.6 is where they ride too (the retarget is its
own commit on this branch). SDK half before the cut: sharddev lifts a no-`ui/level` product's look into `look.level` and
stops writing the four words into discovery.
