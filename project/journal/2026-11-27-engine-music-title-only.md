# 2026-11-27 The engine's music style keeps only its title

Meta standalone shardfiles SF23. Driftwood, Mossgate, Mirror Salt and Pine Hollow now carry their island and pine
recordings as their own slot sets (`sets: { pine: '<slug>' }`), so `ENGINE_MUSIC_SLOTS` drops `island` and `pine`: a
slot played from the engine style is the title, and any other is refused with a message that says to carry it as the
zone's own set. The patch is codex-r2fmt's, kept in `tmp/` until the four zones pinned their own sets; the engine
removes the four recordings once it pins this format.
