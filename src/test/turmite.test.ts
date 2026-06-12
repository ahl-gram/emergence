import { test } from "node:test";
import assert from "node:assert/strict";
import { turmite, TURMITE_WORLD, type TurmiteState } from "../sims/turmite.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(turmite.params);
const { w: W, h: H } = TURMITE_WORLD;

function run(state: TurmiteState, steps: number, p: Params = P): TurmiteState {
  let s = state;
  for (let i = 0; i < steps; i++) s = turmite.step(s, p);
  return s;
}

test("the turmite moves exactly one cell per step", () => {
  let s = turmite.init(1, P);
  for (let i = 0; i < 200; i++) {
    const before = { x: s.x, y: s.y };
    s = turmite.step(s, P);
    const dx = Math.min(Math.abs(s.x - before.x), W - Math.abs(s.x - before.x));
    const dy = Math.min(Math.abs(s.y - before.y), H - Math.abs(s.y - before.y));
    assert.equal(dx + dy, 1, `turmite teleported by (${dx},${dy})`);
  }
});

test("each step changes at most one cell", () => {
  let s = turmite.init(1, P);
  for (let i = 0; i < 200; i++) {
    const before = [...s.grid.cells];
    s = turmite.step(s, P);
    let diff = 0;
    for (let k = 0; k < before.length; k++) if (before[k] !== s.grid.cells[k]) diff++;
    assert.ok(diff <= 1);
  }
});

test("the Langton-ant preset matches the canonical 834 flips at 11k steps", () => {
  const p: Params = { ...P, preset: 1 };
  const s = run(turmite.init(1, p), 11000, p);
  // same rule as the standalone Langton sim — locks the turmite engine
  assert.equal(turmite.stats(s, p).painted, 834);
});

test("the spiral builder keeps growing structure", () => {
  const p: Params = { ...P, preset: 0 };
  const mid = run(turmite.init(1, p), 2000, p);
  const late = run(turmite.init(1, p), 8000, p);
  assert.ok(turmite.stats(late, p).painted > turmite.stats(mid, p).painted * 1.2);
});

test("turmite stays on the torus for every preset", () => {
  for (const preset of [0, 1, 2]) {
    const p: Params = { ...P, preset };
    const s = run(turmite.init(1, p), 5000, p);
    assert.ok(s.x >= 0 && s.x < W && s.y >= 0 && s.y < H);
  }
});

test("same seed and preset replay identically", () => {
  const a = run(turmite.init(3, P), 3000);
  const b = run(turmite.init(3, P), 3000);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
  assert.deepEqual([a.x, a.y, a.dir], [b.x, b.y, b.dir]);
});

test("step does not mutate the previous state", () => {
  const s = run(turmite.init(5, P), 100);
  const before = [...s.grid.cells];
  turmite.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});
