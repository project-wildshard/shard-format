const ONE = 1

/** Bits for a count of 0 to `maxCount`. */
function countBits(maxCount: number): number {
  return Math.max(ONE, Math.ceil(Math.log2(maxCount + ONE)))
}

/** Bits for an index into `size` values. */
function indexBits(size: number): number {
  return Math.max(ONE, Math.ceil(Math.log2(size)))
}

export { countBits, indexBits }
