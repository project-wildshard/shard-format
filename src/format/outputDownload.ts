import * as v from 'valibot';
import { IndexFormatVersionSchema } from './index-format-version.ts';

interface Measured { readonly path: string; readonly hash: string; readonly bytes: number }
export interface OutputDownloadIndex {
  readonly sections: readonly (Measured & { readonly name: string })[];
  readonly schemas: readonly Measured[];
  readonly files: readonly { readonly path: string; readonly hash: string; readonly compressed: number; readonly name?: string;
    readonly tier?: 'phone' | 'desktop'; readonly variantOf?: string }[];
  readonly runtime?: unknown;
  /** iPhone downloads I5: content-hashed packs of the small members (format/outputIndex) */
  readonly packs?: readonly (Measured & { readonly entries: readonly { readonly hash: string; readonly offset: number; readonly bytes: number }[] })[];
}
/** Download metadata only, independent of gameplay schemas. This never admits
 * or publishes a Shardfile. Browser callers first verify the complete index
 * against its build hash; unverified admission keeps the full defining parser. */
export function readOutputDownloadIndex(input: unknown): OutputDownloadIndex {
  const path = v.pipe(v.string(), v.regex(/^(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/u));
  const bytes = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
  const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
  const measured = { path, hash, bytes };
  const listed = v.pipe(v.array(v.object(measured)), v.maxLength(128));
  // SHARD-COMPAT CP14: either envelope; format 0.1.0.2 drops the always-empty schemas list (FORMAT-PRUNE FP4).
  const parsed = v.parse(v.object({ format: v.literal('wildshard.shardfile'), formatVersion: IndexFormatVersionSchema,
    sections: v.pipe(v.array(v.object({ ...measured, name: v.string() })), v.maxLength(256)),
    schemas: v.exactOptional(listed),
    // The compiler and runtime share tier/variant selection. Dropping these
    // existing index facts here reserves bodies this device will never read.
    files: v.pipe(v.array(v.object({ path, hash, compressed: bytes, name: v.exactOptional(v.string()),
      tier: v.exactOptional(v.picklist(['phone', 'desktop'])), variantOf: v.exactOptional(v.string()) })), v.maxLength(8192)),
    runtime: v.unknown(),
    packs: v.exactOptional(v.pipe(v.array(v.object({ ...measured, entries: v.pipe(v.array(v.object({ hash, offset: bytes, bytes })), v.maxLength(8192)) })), v.maxLength(64))),
  }), input);
  const index = { ...parsed, schemas: parsed.schemas ?? [] };
  const paths = ['shard.json', 'validation.json', ...index.sections.map(row => row.path), ...index.schemas.map(row => row.path), ...index.files.map(row => row.path)];
  if (new Set(paths).size !== paths.length) throw new Error('Duplicate shard file download path');
  return index;
}
