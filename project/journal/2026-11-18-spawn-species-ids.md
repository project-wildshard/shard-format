# 2026-11-18: a spawn names a species by its row id (ONE-FORMAT OF11a)

Species rows allow capitals in their ids (Dunes' `sunscar.creature.duneStrider`), but `creatures.spawns[].species` used
the lowercase-only id rule, so no Dunes species could be spawned from a plain upload. The spawn's `species` now takes
the species row grammar; the spawn's own id, variant and brain stay lowercase.
