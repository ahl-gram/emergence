import { test } from "node:test";
import assert from "node:assert/strict";
import { physarum, PHYSARUM_WORLD, type PhysarumState } from "../sims/physarum.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(physarum.params);

function run(state: PhysarumState, steps: number, p: Params = P): PhysarumState {
  let s = state;
  for (let i = 0; i < steps; i++) s = physarum.step(s, p);
  return s;
}

test("agents stay within the periodic world", () => {
  let s = physarum.init(42, P);
  for (let i = 0; i < 40; i++) {
    s = physarum.step(s, P);
    for (let k = 0; k < s.x.length; k++) {
      assert.ok(s.x[k] >= 0 && s.x[k] < PHYSARUM_WORLD.w);
      assert.ok(s.y[k] >= 0 && s.y[k] < PHYSARUM_WORLD.h);
    }
  }
});

test("trail values stay finite and non-negative", () => {
  let s = physarum.init(7, P);
  s = run(s, 80);
  for (const v of s.trail.cells) {
    assert.ok(v >= 0 && Number.isFinite(v));
  }
});

test("a network forms: coverage rises then stabilizes below saturation", () => {
  let s = physarum.init(1, P);
  const start = physarum.stats(s, P).coverage;
  s = run(s, 120);
  const cov = physarum.stats(s, P).coverage;
  assert.ok(cov > start + 5, `network should grow, ${start.toFixed(1)} -> ${cov.toFixed(1)}`);
  assert.ok(cov < 100, "a real network never fills the whole dish");
});

test("high evaporation cannot sustain as much network as low", () => {
  const lo = run(physarum.init(3, { ...P, evaporation: 0.02 }), 150, { ...P, evaporation: 0.02 });
  const hi = run(physarum.init(3, { ...P, evaporation: 0.18 }), 150, { ...P, evaporation: 0.18 });
  assert.ok(
    physarum.stats(lo, P).coverage > physarum.stats(hi, P).coverage,
    "low evaporation should hold a denser network",
  );
});

test("same seed weaves the same network", () => {
  const a = run(physarum.init(5, P), 60);
  const b = run(physarum.init(5, P), 60);
  assert.deepEqual([...a.trail.cells], [...b.trail.cells]);
  assert.deepEqual([...a.x], [...b.x]);
});

test("step does not mutate the previous state", () => {
  const s = physarum.init(9, P);
  const trail = [...s.trail.cells];
  const x = [...s.x];
  physarum.step(s, P);
  assert.deepEqual([...s.trail.cells], trail);
  assert.deepEqual([...s.x], x);
});
