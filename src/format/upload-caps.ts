/**
 * The upload caps every host shares (EG-8, D31, J137). api-server refuses a
 * bigger upload and the cook refuses a bigger read; both import this one
 * number, so they cannot drift apart again (BUG-3: the cook refused Pine's
 * 300 MB head while the API took 450 MB).
 */

/**
 * The largest shardfile tarball, stored or once decoded. The API commit
 * streams through its `/tmp` (500 MB), which bounds it; Pine Hollow is the
 * largest at 372 MB.
 */
export const MAX_SHARDFILE_BYTES = 450_000_000
