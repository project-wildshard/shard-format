// SDK-SPLIT SP4a (Q35): the seeded RNG is a format law. The golden vectors were drawn from the engine's own Rng
// (engine shared/engine/core/rng.ts), so this file proves the format copy matches it bit for bit.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Rng, fnv1a32 } from './seededRng.ts';
import type { RngPort, RngState } from './seededRng.ts';

interface Draws {
  readonly next: readonly string[]; readonly range: string; readonly int: number; readonly pick: string;
  readonly chance: boolean; readonly weighted: string; readonly state: RngState;
}
interface GoldenCase {
  readonly seed: number; readonly first: Draws; readonly numberFork: Draws; readonly stringFork: Draws;
  readonly scrambled: Draws; readonly scrambledFork: Draws;
}
interface Golden { readonly cases: readonly GoldenCase[]; readonly hashes: readonly { readonly text: string; readonly hash: number }[] }

const golden = JSON.parse(readFileSync(new URL('seededRng.golden.json', import.meta.url), 'utf8')) as Golden;

/** IEEE-754 float64 bits, big-endian hex: the comparison is bit-exact, not approximate. */
function bits(value: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  return view.getBigUint64(0).toString(16).padStart(16, '0');
}

function draw(rng: RngPort): Draws {
  return {
    next: Array.from({ length: 8 }, () => bits(rng.next())),
    range: bits(rng.range(-3.5, 7.25)),
    int: rng.int(-10, 10),
    pick: rng.pick(['a', 'b', 'c', 'd', 'e']),
    chance: rng.chance(0.37),
    weighted: rng.weighted([['x', 1], ['y', 2.5], ['z', 0.5]]),
    state: rng.snapshot(),
  };
}

describe('seededRng matches the engine bit for bit', () => {
  it('has golden cases', () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(7);
  });
  for (const golden_ of golden.cases) {
    it(`seed ${String(golden_.seed)}: draws, forks and the scrambled mode`, () => {
      const plain = new Rng(golden_.seed);
      expect(draw(plain)).toEqual(golden_.first);
      expect(draw(plain.fork(3))).toEqual(golden_.numberFork);
      expect(draw(plain.fork('trees'))).toEqual(golden_.stringFork);
      const scrambled = Rng.scrambled(golden_.seed);
      expect(draw(scrambled)).toEqual(golden_.scrambled);
      expect(draw(scrambled.fork(7))).toEqual(golden_.scrambledFork);
    });
  }
  it('fnv1a32 hashes as the engine does', () => {
    for (const { text, hash } of golden.hashes) expect(fnv1a32(text)).toBe(hash);
  });
  it('restores a snapshot and refuses a bad one', () => {
    const rng = new Rng(42);
    rng.next();
    const saved = rng.snapshot();
    const after = rng.next();
    rng.restore(saved);
    expect(rng.next()).toBe(after);
    expect(() => { rng.restore({ ...saved, version: 2 }); }).toThrow(RangeError);
    expect(() => { rng.restore({ ...saved, state: -1 }); }).toThrow(RangeError);
  });
  it('weighted refuses an empty list', () => {
    expect(() => new Rng(1).weighted([])).toThrow('Rng.weighted on an empty list');
  });
});
