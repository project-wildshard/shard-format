# FP43's kept originals: `population.homes` leaves through the chain

> Written by: Claude (opus-prune3)

FP33's proof ran the chain over all 113 kept originals (the API catalogue, read only, tarballs from the pin cache) and
found 8 already refused on main before FP33: Far Reach r1 and r3 to r6, Sunscar Dunes r1, r2 and r5 still carry
`population.homes`, which FP43 (`8f87901`) took out of the client plan. Its break entries said the kept-originals corpus
carried none; the corpus fixtures don't, but the stored originals do. CP16 says no kept original is dropped.

- Step `fp43-homes-to-members` (to 0.1.0.5, with FP33): the copy drops the row, and a trail row that followed one of its
  groups names that group's members, the spawn ids the homes row listed (Far Reach's ray wake), as FP38 did by hand.
- After it: 113 of 113 admit (as stored or through the chain), 0 refused; every copy carries no `requires.sdk`.
- The lesson for the next delete: the corpus fixtures are not the kept originals. Run the chain over the catalogue.
