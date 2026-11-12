# Brasscap Mesa: walkable edge entries and the card hero (ENG-3b)

> Written by: Claude (opus-eng3b)

- Engine pinned Brasscap rev 2 and Ring 1's cook refused it: "Blocked
  edge entry north lane 0 at 33.23m". Engine's cook walks a real capsule
  down every 8 m entry lane for 50 m and needs road height (y 0) all the
  way. The format only checks the first 15 m (`ENTRY_ASPHALT`), so
  sharddev's prepare and the API validator passed it.
- The cause was on all four edges: the canyon floor sits at about 1 m
  inside the 216 m rim, so each lane hit a 1 m step 34 m in. On the
  north lane a background mesa also stood 47.7 m in.
- `canyon.ts` now keeps the floor at 0 within 12 m of each midline from
  192 m out. It moves any mesa whose footprint crosses a lane corridor
  sideways. Neither change draws `rand`, so nothing else in the level
  moves. `rebake.ts --write` re-cooked the corpus: 70 of 235 files
  changed, and all four lanes now hold no off-road triangle.
- Card hero: opus-hero's in-engine captures (thumb 640x360, portrait
  804x1626, landscape 1600x900) are image blobs, and discovery's card
  names them. They replace the generated SVG card.
