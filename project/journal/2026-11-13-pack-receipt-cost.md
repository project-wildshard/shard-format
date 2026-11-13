# 2026-11-13 pack restamps receipt figures

- Brasscap rev 3 (`blender-template`, `5400ea84`) shipped a receipt
  saying 2,930,740 bytes of memory over 4,670,827 bytes of files; the
  formula gives 5,842,839. `pack`'s `sealed` rewrote `sourceHash` and
  `indexHash` and kept every other field from the old receipt.
- `pack` now measures `residentBytes`, `worst`, `postCost` and
  `gridReady` again from the product the validator admitted, through the
  new `src/format/receipt-cost.ts`, with the same four functions
  sharddev's writer calls. A repack of an unchanged product (the CLI
  fixture, Template 2; the review lane also tried 24 real products)
  gives the receipt back byte for byte. The receipt is now written
  canonical (`validationSourceBytes`), like sharddev's.
- `productWireBytes` is split out of `publishedSourceResidency`, so the
  floor and the full figure share one sum.
- `shardfile validate` warns when `residentBytes` is below the files'
  bytes, and when the receipt can't be read. A warning, not a refusal:
  the pinned Brasscap rev 3 trips it (the only one of 28 pins that
  does). It can become a refusal after Brasscap rev 4.
- Follow-ups: a shard-format release, then Brasscap rev 4 packed with
  it; sharddev can call `receiptCost` instead of the four functions.
