# A POI may opt out of respawning (opus-brassgun4, TEMPLATE-E2E)

- Engine TC-E3 (`dataCellPlaces`) makes every manifest POI of a data cell a
  respawn place when the product publishes none, so a death in Brasscap's
  Dust Wyrm pit (a POI) came back inside the pit. The open SHOULD from
  TC-E3's review asked for an opt-out.
- `manifest.pois[].respawn` is an optional boolean; `false` keeps the POI
  on the map but out of the respawn places. Absent means as before. The
  engine reads it once it pins this version.
