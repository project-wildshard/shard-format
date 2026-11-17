/* oxlint-disable import/group-exports, no-magic-numbers -- verbatim port of the engine's law (SDK-SPLIT SP4); golden vectors pin it, so it keeps the engine's form */
/** SDK-SPLIT SP4f1 (Q35): the road's key light (`ROAD_SKY`, from engine `client/game/grid/frameModel.ts`) and the far
 *  cliffs' light floor (`FAR_CLIFF_FLOOR`, from `client/game/grid/farView.ts`): the far impostor bake lights like the engine. */
/**
 * G165 (Jake: "A, road light over everything") and G242 (Jake's pick B, "grid dawn", `art/grid/round-26-road-sky/B-grid-dawn.jpg`):
 * the road's own sky and key light, which replace the page's while the player is on the road (`roadSky.ts`). One shader
 * dome, no textures: a dawn gradient (a peach horizon, a lavender band, a clear blue zenith), a thin cyan horizon line and a
 * faint cyan grid round the horizon echoing the HUD and the VR void; a low warm dawn sun. Colours are linear RGB.
 * - `air`: the road's air (the frame's fog colour on the road, which the far proxies haze into) and the dome's horizon;
 * - `mid` / `zenith`: the dome's lavender band and its zenith;
 * - `line` / `grid`: the cyan horizon line and grid, `gridStrength` the grid's opacity at the horizon;
 * - `void`: G630, the blue-violet past the grid floor (the dome below the horizon, the grid page's background), on the road
 *   and with a cell entered alike (the shipped 10-13 hero's);
 * - `sun`: the key light (compass degrees, its colour, its intensity) and the glow it puts in the dome;
 * - `hemi`, `env`, `fogSun`: the fill, the environment's intensity and the fog's in-scatter colour under it.
 */
export const ROAD_SKY = {
  air: [0.95, 0.56, 0.44] as const,
  mid: [0.58, 0.46, 0.8] as const,
  zenith: [0.1, 0.24, 0.72] as const,
  line: [0.25, 1.1, 1.4] as const,
  grid: [0.3, 0.85, 1.1] as const,
  gridStrength: 0.3,
  void: [0.17, 0.17, 0.27] as const,
  sun: {
    azimuth: 70,
    elevation: 13,
    colour: [1, 0.8, 0.66] as const,
    intensity: 2.4,
    glow: [1, 0.62, 0.42] as const,
  },
  hemi: {
    sky: [0.6, 0.62, 0.86] as const,
    ground: [0.42, 0.36, 0.34] as const,
    intensity: 1.1,
  },
  env: 0.7,
  fogSun: [1, 0.72, 0.56] as const,
} as const

/**
 * Playtest round 2: the light floor of the boundary face, as a multiple of its rock colour added after lighting. A face that
 * turns away from the frame's sun got no light at all under a frame without an ambient term (any page where no admitted
 * shard brings its sky light), so every shaded cliff drew as a pitch-black 100 m slab beside the road; with the floor a
 * shaded face is the rock's own colour dimmed (×0.8) and a sunlit one only slightly brighter than before.
 */
export const FAR_CLIFF_FLOOR = 0.8
