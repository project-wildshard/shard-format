// Golden vectors for SDK-SPLIT SP4a, drawn from the ENGINE's own Rng (the oracle). Usage: node rng-golden.mjs <engine-rng.ts> <out.json>
import { writeFileSync } from 'node:fs'
const { Rng, fnv1a32 } = await import(process.argv[2])
const bits = x => { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x); return b.getBigUint64(0).toString(16).padStart(16, '0') }
const seeds = [0, 1, 0x5ea1, 0x7fffffff, 0xffffffff, 2654435761, 123456789]
const draw = rng => ({
  next: Array.from({ length: 8 }, () => bits(rng.next())),
  range: bits(rng.range(-3.5, 7.25)),
  int: rng.int(-10, 10),
  pick: rng.pick(['a', 'b', 'c', 'd', 'e']),
  chance: rng.chance(0.37),
  weighted: rng.weighted([['x', 1], ['y', 2.5], ['z', 0.5]]),
  state: rng.snapshot(),
})
const cases = []
for (const seed of seeds) {
  const plain = new Rng(seed)
  const first = draw(plain)
  const numberFork = draw(plain.fork(3))
  const stringFork = draw(plain.fork('trees'))
  const scrambled = Rng.scrambled(seed)
  const scrambledDraws = draw(scrambled)
  const scrambledFork = draw(scrambled.fork(7))
  cases.push({ seed, first, numberFork, stringFork, scrambled: scrambledDraws, scrambledFork })
}
const hashes = ['', 'a', 'trees', '0x5ea1:gameplay', 'héllo wörld', '🌲'].map(text => ({ text, hash: fnv1a32(text) }))
writeFileSync(process.argv[3], `${JSON.stringify({ about: 'SDK-SPLIT SP4a: engine shared/engine/core/rng.ts draws; floats are IEEE-754 float64 bits, big-endian hex', cases, hashes }, null, 1)}\n`)
