# Declared owner boss needs no page boss feature (OF20c)

> Written by: Claude (opus-of-close2)

Sky Reach's Storm Roc moves off the runtime plan's keeper to a declared boss encounter, but the plan keeps its owner
row so the engine can hang the victory flag, fact, purse and save on that encounter. The client ownership rule still
asked the page for a `boss.held` feature whenever a plan had an owner row, which would draw a keeper fight that no
longer exists. Now an owner row naming a declared spawn with a boss encounter expects no page boss feature; the boss
panel comes from the encounter's declared `ui` row.
Lint and format fixes folded in before the first push.
