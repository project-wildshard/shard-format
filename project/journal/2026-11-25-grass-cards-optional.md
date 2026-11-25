# Grass cards are optional

- QA 11-24 row 70: Nalati's grass stopped drawing its card clumps (row 54,
  J510), but the format still required them, so the shard kept a card
  scene and atlas it never drew. Every card part (both tiers' rows and
  scenes, the third look, `cardsHeight`, the painted grass's atlas) is
  optional now, all together; `cardsAgree` refuses a half-dropped set.
  Engine skips the cards when they're absent; Nalati drops them after
  the next format release reaches its pins.
