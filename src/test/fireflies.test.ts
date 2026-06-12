import { test } from "node:test";
import assert from "node:assert/strict";
import { fireflies, FIREFLIES_WORLD, type FirefliesState } from "../sims/fireflies.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(fireflies.params);

function run(state: FirefliesState, steps: number, p: Params = P): FirefliesState {
  let s = state;
  for (let i = 0; i < steps; i++) s = fireflies.step(s, p);
  return s;
}

test("phases always stay in [0, 1)", () => {
  let s = fireflies.init(42, P);
  for (let i = 0; i < 300; i++) {
    s = fireflies.step(s, P);
    for (const f of s.flies) {
      assert.ok(f.phase >= 0 && f.phase < 1, `phase out of range: ${f.phase}`);
    }
  }
});

test("fireflies never move; only their clocks change", () => {
  const s = fireflies.init(7, P);
  const positions = s.flies.map((f) => [f.x, f.y]);
  const end = run(s, 100);
  assert.deepEqual(end.flies.map((f) => [f.x, f.y]), positions);
  for (const f of end.flies) {
    assert.ok(f.x >= 0 && f.x < FIREFLIES_WORLD.w);
    assert.ok(f.y >= 0 && f.y < FIREFLIES_WORLD.h);
  }
});

test("same seed replays the same field", () => {
  const a = run(fireflies.init(5, P), 400);
  const b = run(fireflies.init(5, P), 400);
  assert.deepEqual(a.flies, b.flies);
});

test("coupling produces synchronization", () => {
  const p: Params = { ...P, count: 200, radius: 400, nudge: 0.08, spread: 0.03 };
  let s = fireflies.init(1, p);
  const start = fireflies.stats(s, p).sync;
  assert.ok(start < 0.3, `random phases should start incoherent, got ${start}`);
  s = run(s, 4000, p);
  const end = fireflies.stats(s, p).sync;
  assert.ok(end > 0.8, `field should synchronize, got ${end}`);
});

test("without coupling there is no sync", () => {
  const p: Params = { ...P, nudge: 0, spread: 0.05 };
  let s = fireflies.init(3, p);
  s = run(s, 4000, p);
  const end = fireflies.stats(s, p).sync;
  assert.ok(end < 0.35, `uncoupled clocks must stay incoherent, got ${end}`);
});

test("step does not mutate the previous state", () => {
  const s = fireflies.init(11, P);
  const before = s.flies.map((f) => ({ ...f }));
  fireflies.step(s, P);
  assert.deepEqual(s.flies, before);
});
