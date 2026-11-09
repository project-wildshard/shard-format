# Keep the consumer proof independent of registry metadata

Exact hosted CI 42720775264 found ERR_PNPM_NO_OFFLINE_META: a frozen
root install has the pinned valibot bytes but no registry metadata.
My new consumer test accidentally depended on that warm metadata.

Pack the actual pinned dependency beside the wire tarball and give
pnpm a file override. The override does not add a missing dependency;
the installed dependency still must resolve inside the consumer.
Each proof now uses a fresh private store and metadata directory, so
there is no warm registry cache to hide the hosted failure. Both the
offline install and frozen reinstall remain real, and the existing
CLI, lock and frozen-source refusal assertions are unchanged.

CI=true passes locally in about 1.2 s with strict lint and types. No
package pin, runtime codec, network access or CI check is relaxed.
