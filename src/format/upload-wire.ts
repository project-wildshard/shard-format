import {
  array,
  boolean,
  integer,
  literal,
  minValue,
  number,
  object,
  optional,
  pipe,
  record,
  regex,
  string,
  variant,
} from 'valibot'

import type { GenericSchema } from 'valibot'

// The large-file upload's wire shapes (J60, J61, J96): what `sharddev upload`
// sends and api-server answers. Both depend on this repo and neither on the
// other (J27), so a change here reaches both through a tag, and a client
// fails on the parse rather than guess.

const FIRST_REVISION = 1
const MIN_STORED_BYTES = 1
const HASH = /^[\da-f]{64}$/u
const SLUG = /^[a-z][\d.a-z-]{0,127}$/u

/** Lowercase hex SHA-256 of the shardfile's exact bytes. */
const ShardfileHashSchema: GenericSchema<string> = pipe(string(), regex(HASH))

/** A shard's slug: the shardfile's `identity.slug`. */
const ShardSlugSchema: GenericSchema<string> = pipe(string(), regex(SLUG))

/** A shard's revision number in the catalogue: 1, 2, 3, ... per shard. */
const RevisionNumberSchema: GenericSchema<number> = pipe(
  number(),
  integer(),
  minValue(FIRST_REVISION),
)

/** `br` when the author compressed the tarball (J84, J96). */
type ContentEncoding = 'br' | undefined

interface RevisionOfShard {
  readonly shard: string
  readonly revision: number
}

interface ShardfileSummary {
  readonly hash: string
  /** The tarball's size. */
  readonly bytes: number
  /** What the stored object weighs: the author's Brotli, or the tarball. */
  readonly storedBytes: number
  readonly uploadedAt: string
  readonly revisions: RevisionOfShard[]
}

interface ShardfileList {
  readonly shardfiles: ShardfileSummary[]
}

interface UploadResult {
  readonly hash: string
  readonly shard: string
  readonly revision: number
  /** This upload added the revision. */
  readonly created: boolean
  /** This upload made the revision the shard's preview. */
  readonly staged: boolean
  readonly bytes: number
  readonly storedBytes: number
  readonly signedBy: string
  readonly notified: boolean
}

/** Ask for a presigned PUT, past Vercel's body cap. */
interface DirectUploadRequest {
  /** The tarball's hash: the bytes the signature covers. */
  readonly hash: string
  /** What the PUT will carry: the compressed size when it is compressed. */
  readonly storedBytes: number
  readonly contentEncoding?: ContentEncoding
}

interface DirectUploadPut {
  readonly stored: false
  readonly method: 'PUT'
  readonly url: string
  readonly headers: Record<string, string>
  readonly expiresAt: string
}

/** Already stored: nothing to send. Otherwise the PUT to make, exactly. */
type DirectUploadTicket = { readonly stored: true } | DirectUploadPut

interface DirectCommitRequest {
  readonly contentEncoding?: ContentEncoding
}

interface ErrorBody {
  readonly error: string
}

const ContentEncodingSchema = optional(literal('br'))

const RevisionOfShardSchema: GenericSchema<RevisionOfShard> = object({
  shard: ShardSlugSchema,
  revision: RevisionNumberSchema,
})

const ShardfileSummarySchema: GenericSchema<ShardfileSummary> = object({
  hash: ShardfileHashSchema,
  bytes: number(),
  storedBytes: number(),
  uploadedAt: string(),
  revisions: array(RevisionOfShardSchema),
})

const ShardfileListSchema: GenericSchema<ShardfileList> = object({
  shardfiles: array(ShardfileSummarySchema),
})

const UploadResultSchema: GenericSchema<UploadResult> = object({
  hash: ShardfileHashSchema,
  shard: ShardSlugSchema,
  revision: RevisionNumberSchema,
  created: boolean(),
  staged: boolean(),
  bytes: number(),
  storedBytes: number(),
  signedBy: string(),
  notified: boolean(),
})

const StoredBytesSchema = pipe(number(), integer(), minValue(MIN_STORED_BYTES))

const DirectUploadRequestSchema: GenericSchema<DirectUploadRequest> = object({
  hash: ShardfileHashSchema,
  storedBytes: StoredBytesSchema,
  contentEncoding: ContentEncodingSchema,
})

const StoredTicketSchema = object({ stored: literal(true) })

const PutTicketSchema = object({
  stored: literal(false),
  method: literal('PUT'),
  url: string(),
  headers: record(string(), string()),
  expiresAt: string(),
})

const DirectUploadTicketSchema: GenericSchema<DirectUploadTicket> = variant(
  'stored',
  [StoredTicketSchema, PutTicketSchema],
)

const DirectCommitRequestSchema: GenericSchema<DirectCommitRequest> = object({
  contentEncoding: ContentEncodingSchema,
})

const ErrorBodySchema: GenericSchema<ErrorBody> = object({ error: string() })

export {
  DirectCommitRequestSchema,
  DirectUploadRequestSchema,
  DirectUploadTicketSchema,
  ErrorBodySchema,
  RevisionNumberSchema,
  ShardSlugSchema,
  ShardfileHashSchema,
  ShardfileListSchema,
  ShardfileSummarySchema,
  UploadResultSchema,
  type DirectCommitRequest,
  type DirectUploadRequest,
  type DirectUploadTicket,
  type ErrorBody,
  type ShardfileList,
  type ShardfileSummary,
  type UploadResult,
}
