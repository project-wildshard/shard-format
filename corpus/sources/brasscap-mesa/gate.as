// Brasscap Mesa's gate (BM-4), an ABI v0 scene hook in the shape of Template 1's door.as.
// The quest `brasscap.bandits` completes when the third camp falls; its onComplete scene
// `brasscap.gate.open` queues event 301. That sets shared field 101 `brasscap.gate.open`
// once, for good, and the target panel hides the gate door and drops its collider.
// Shared fields arrive sorted by id after the state counts; 101 is the only one.
// Compiled once by the author (sharddev's pinned AssemblyScript, 2 pages); the bytes ship raw.
export function abi_version(): i32 { return 0; }
export function init(lo: i32, hi: i32): void {}
export function in_ptr(): i32 { return 16384; }
export function in_cap(): i32 { return 4096; }
export function out_ptr(): i32 { return 24576; }
export function out_cap(): i32 { return 4; }
let count: i32 = 0;
let ticks: i32 = 0;
export function out_count(): i32 { return count; }
@inline function setShared(field: f64, value: f64): void {
  const at = 24576 + count * 40;
  store<f64>(at, 5); store<f64>(at + 8, field); store<f64>(at + 16, value); store<f64>(at + 24, 0); store<f64>(at + 32, 0);
  count += 1;
}
export function on_tick(): void {
  count = 0; ticks += 1;
  const open = load<f64>(16384 + 64);
  const events = i32(load<f64>(16384 + 256));
  let opening = false;
  for (let i = 0; i < events; i++) if (load<f64>(16384 + (33 + i * 6) * 8) === 301) opening = true;
  if (opening && open < 0.5) setShared(101, 1);
  store<i32>(30000, ticks); // continuation witness lives outside input/output regions
}
