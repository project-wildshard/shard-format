# Pinned source inventories

OF1a starts with an immutable source reader: one tree listing and one
batched blob read per pinned repository. It does not change the source
checkout or consume another lane's loose edits. Duplicate blobs retain
each source path. The format's own working inventory also reads corpus
JSON and excludes build output. Full source commit ids are required.

Two focused tests prove revision isolation, duplicate blobs, explicit
revision refusal and working-tree scope. Types and targeted lint pass.
OF1a stays open until product pins, every audit counter and the baseline
have their own receipts. This commit changes no runtime contract.
