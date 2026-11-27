import type { CookMount } from './cook-data.ts'

/** J525: identify legacy phone copies beside their original mounts. */
export function phoneCopyWarnings(
  mounts: readonly Readonly<CookMount>[],
): string[] {
  const urls = new Set(mounts.map((mount): string => mount.url))
  const warnings: string[] = []
  for (const url of urls) {
    const original = url.replace(/[.-]phone(?=\.[^./]+$)/u, '')
    if (original !== url && urls.has(original)) {
      warnings.push(
        `J525: ${url} is a hand-made phone copy of ${original}. Keep the original and let the cook make tier variants.`,
      )
    }
  }
  return warnings
}
