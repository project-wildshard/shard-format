import { SHARDFILE_ADMISSION_LIMITS as L } from './admissionLimits.ts';
import { parseSketchSvg, sketchReference, type CompendiumSketch } from './sketch.ts';
import type { ShardRows } from './rows.ts';

const prefix = 'data:image/svg+xml,';
type SketchRow = Readonly<{ kind: 'journal'; icons: readonly Readonly<{ image?: string; icon?: string }>[] }> | Readonly<{ kind?: never; entries: readonly Readonly<{ sketch: string }>[] }>;
function sketchRefs(row: SketchRow): string[] {
  if (row.kind === 'journal') {
    return row.icons.flatMap((value: Readonly<{ image?: string; icon?: string }>): string[] => value.image?.startsWith(prefix) === true ? [value.image] : []);
  }
  return row.entries.map((entry: Readonly<{ sketch: string }>): string => entry.sketch);
}

/** Resolve each distinct sketch once from already-admitted bytes and derive its extra raster cost. */
export function compendiumSketches(rows: Pick<ShardRows, 'compendiums'>, assets: ReadonlyMap<string, Uint8Array>): ReadonlyMap<string, CompendiumSketch> {
  const result = new Map<string, CompendiumSketch>();
  const refs = rows.compendiums.flatMap(sketchRefs);
  for (const ref of refs) {
    if (result.has(ref)) continue;
    if (!sketchReference(ref)) throw new Error('Compendium sketch must be bounded inert SVG data or an admitted hash');
    if (ref.startsWith(prefix)) result.set(ref, parseSketchSvg(decodeURIComponent(ref.slice(prefix.length))));
    else {
      const bytes = assets.get(ref); if (bytes === undefined || bytes.length > L.textCharacters) throw new Error('Missing or oversized admitted sketch SVG');
      result.set(ref, parseSketchSvg(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    }
  }
  return result;
}
