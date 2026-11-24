# The look tests get their own file

> Written by: Claude (opus-pr6). Meta FORMAT-PRUNE FP47b and FP47c, landing the 0.1.0.6 stack.

Landing the stack (FP34 > FP36 > FP47b > FP27c > FP47c) on main, the push gate's src/format ratchet refused it:
`format-migration-manifest.test.ts` passed 300 lines with lowercase comments and a long test, and the map image
deprecation read `keptMapImage` and `NONE` before they were defined. The FP47b and FP47c tests now live in
`format-migration-look.test.ts`, one claim a test, and the deprecation sits after the helper it reads. `pnpm check`
green locally before the push.
