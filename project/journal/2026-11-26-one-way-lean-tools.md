# The one-way ceiling leaves lean tools out

> Written by: Claude (opus-rows101), 2026-11-26, meta QA 11-25 row 101.

Engine's lean move (`f928fdae2`) put `test/tooling/` at `src/test/`, so
the one-way counter started reading engine's tool tests as engine source:
`engine.retired-vocabulary: 0 -> 10`, all ten in `src/test/`
(browser-escape's Playwright `trusted` events, pins-reuse, agent-network's
"third-party"). No game source carried a word. Every format push failed
its gate; `9c1ebd8` went out under `WS_ONE_WAY_ENGINE_REVISION=fff4ae3fb`.

The tooling rule now leaves out `src/scripts/`, `src/test/` and every
`.kit/` folder, as the old layout's outside-`src/` tools never counted.
A fixture test plants the word in each and fails without the rule.
