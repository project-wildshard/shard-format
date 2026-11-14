# Brasscap cleanroom port (TEMPLATES-CLEANROOM B2)

Lane opus-brassport, 2026-11-13.

- The cleanroom (`~/projects/games/wildshard/brasscap-cleanroom` `ebd7aa7`) lights Brasscap with things
  `look.json` could not say: real point lights at lanterns, tents and fires; a warm bounce from the sand;
  a sky-and-sand environment (PMREM) as ambient; and three's Neutral tone curve, which keeps the
  saturated reds that the engine's AgX greyed. Format: `look.light.lamps` (<= 16), `bounce`,
  `environment`, and `look.grade.tone` (`agx` | `neutral`). Each absent is off.
- Port: the cleanroom's colours are sRGB hex, the look's are linear, so every colour was converted
  (the old look stored sRGB-looking numbers as linear, which is why the engine read pale and washed out).
  The sun moves ahead-left at 31.7 degrees (`day.azimuth` -32.2, `maxElevation` 39.3 at hour 9.6), the
  sky graph gets the cleanroom's three stops (horizon, mid, zenith), and the fog spans the cleanroom's
  FogExp2 0.0052 as linear 40 to 330 m. `brasscap-mesa.test.ts`'s sun bound goes from 20 to 45 degrees.
- `rebake.ts` leaves the four additions out of the bake look, as it does `post`: a sharddev on an older
  format refuses them and the cook never reads them.
