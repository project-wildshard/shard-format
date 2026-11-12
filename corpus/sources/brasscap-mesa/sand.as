// Brasscap Mesa's particle anchors (BM-5), an ABI v0 client script: the Dust Wyrm's sand-ring tell and its open gullet.
// Presentation only. It reads its one copied shared field and its declared parameters, and writes one particle op (104)
// per emitter while that field is 1; an anchor has no pose. Compiled once by the author (sharddev's pinned
// AssemblyScript, 1 page); the bytes ship raw.
//
// IN (f64 at 16384): [tick, divisor/60, frozen, self, x, y, z, readCount, ...values]
// parameters (query 410): [count, rate, emitter]: `count` emitters from `emitter` on, each at `rate`, every step.
@external("env", "query") declare function query(kind: i32, input: i32, output: i32): i32;
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 4; }
let count: i32 = 0;
export function out_count(): i32 { return count; }
export function on_tick(): void {
  count = 0;
  query(410, 31000, 32000);
  const emitters = load<f64>(32000), rate = load<f64>(32008), emitter = load<f64>(32016);
  if (load<f64>(16384 + 56) < 1 || load<f64>(16384 + 64) < 0.5) return;
  for (let k: f64 = 0; k < emitters && count < 4; k++) {
    const at = 24576 + count * 40;
    store<f64>(at, 104); store<f64>(at + 8, emitter + k); store<f64>(at + 16, rate); store<f64>(at + 24, 0); store<f64>(at + 32, 0);
    count += 1;
  }
}
