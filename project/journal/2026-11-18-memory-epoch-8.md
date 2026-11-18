# Memory epoch 8: refit to engine 0af7ccd8 (mini-pinemem5, MEMORY-GATES MG10)

> Written by: Claude

Epoch 7's weights were fitted to an every-zone sweep on engine `50092092`; engine cuts since then (Nine's GL 217 -> 162 MB,
the transient trims) only reach the gates through a refit. Swept all 27 pinned zones on engine main `0af7ccd8` (99 cold
WebKit runs, inspector minimal, 6 per heavy zone, each under the mini measure lock), converted with `memory-em11.mjs`, refit
with `memory-fit.mjs`. Ratio playing 1.218 (was 1.313), loading 1.209 (was 1.197).

EM11 now reads Nalati's loading upper at 1,457 MB, under 1.5 GB. Keeping that verdict forces a 4.6x geometry weight
that raises Nine's loading estimate to 2,170 MB, so the fit exempts it (`--exempt=loading:nalati-grasslands`); Nalati's
estimate still falls 1,727 -> 1,582 MB, under its J412 ratchet. Every golden estimate falls except Far Reach's playing
(944 -> 1,000 MB, still under its envelope and over its EM11 upper). Built mains: Nine `9b0731d2` 1,036 / 1,454 MB, Pine
`52486c7` 921 / 1,299 MB playing / loading. Readings stay current from epoch 3.
