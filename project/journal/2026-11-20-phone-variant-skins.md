# Phone skins for variant looks

> Written by: Claude

ONE-FORMAT OF23f. A skin look with a variant table could not have a phone
skin, so Pine's creatures drew their desktop meshes and maps on the phone.
A variant look now names `phone` (its phone default) and `phoneVariants`
(a phone variant table): every variant's lighter skin, held to that
variant's rig and material contract and at most its triangles. The three
go together; any one alone refuses.

Tier selection now drops the other tier's skin files for any look with a
phone skin (CC51b looks too): the skins, the table, and the GLBs and maps
only they reach. A phone runtime resolves its skins with
`resolveSkinLookTier`, which reads only that tier's bytes.
