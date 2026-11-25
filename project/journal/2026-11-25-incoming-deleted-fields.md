# Old clients' uploads pass the strict index

- FORMAT-PRUNE FP60: format 0.79.1's strict index refused every upload
  from a published client. `@wildshard/upload` 0.4.22 (the oldest
  supported) checks with format 0.63.0 and 0.4.25 with 0.66.0; both
  send `requires.sdk`, which FP33 deleted, so the API stayed on 0.78.0.
- Both validators now read an original's index and sections through
  `incoming.ts`, which mends each deleted field (`requires.sdk`, the
  old grid pointer) before the strict parse. The client hashed the
  index as it sent it, so the source hash and the cook preparation's
  input hash are also checked against that form (`incoming-sent.ts`
  remembers the sent value; a leaf, since `outputIndex.ts` reaches the
  preparation check). A wrong hash is still refused.
- The guard (J505): `incoming-deleted-fields.test.ts` runs an upload as
  those clients send it through both validators; ci.yml runs it on main
  and `release/**`, so no release ships that refuses them again. The
  API's CP4b end to end runs the real 0.4.22 and 0.4.25 clients.
