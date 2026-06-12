import { test } from "node:test";
import assert from "node:assert/strict";
import { dla, DLA_WORLD, type DlaState } from "../sims/dla.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(dla.params);
const { w: W, h: H } = DLA_WORLD;

function run(state: DlaState, steps: number, p = P): DlaState {
  let s = state;
  for (let i = 0; i < steps; i++) s = dla.step(s, p);
  return s;
}

test("starts from a single seed at the center", () => {
  const s = dla.init(1, P);
  assert.equal(s.size, 1);
  assert.equal(s.grid.cells[(H >> 1) * W + (W >> 1)], 1);
});

test("the cluster grows", () => {
  const s = run(dla.init(1, P), 40);
  assert.ok(s.size > 50, `expected growth, size is ${s.size}`);
});

test("size only ever increases", () => {
  let s = dla.init(2, P);
  let prev = s.size;
  for (let i = 0; i < 30; i++) {
    s = dla.step(s, P);
    assert.ok(s.size >= prev);
    prev = s.size;
  }
});

test("cluster size matches the number of marked cells", () => {
  const s = run(dla.init(3, P), 30);
  let marked = 0;
  for (const v of s.grid.cells) if (v > 0) marked++;
  assert.equal(marked, s.size);
});

test("every particle stuck to an earlier neighbor (connectivity)", () => {
  const s = run(dla.init(5, P), 50);
  const cells = s.grid.cells;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const age = cells[y * W + x];
      if (age <= 1) continue;
      const neighbors = [
        x > 0 ? cells[y * W + x - 1] : 0,
        x < W - 1 ? cells[y * W + x + 1] : 0,
        y > 0 ? cells[(y - 1) * W + x] : 0,
        y < H - 1 ? cells[(y + 1) * W + x] : 0,
      ];
      const hasOlder = neighbors.some((n) => n > 0 && n < age);
      assert.ok(hasOlder, `cell (${x},${y}) age ${age} floats free`);
    }
  }
});

test("same seed grows the same coral", () => {
  const a = run(dla.init(7, P), 40);
  const b = run(dla.init(7, P), 40);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
});

test("step does not mutate the previous state", () => {
  const s = run(dla.init(9, P), 10);
  const before = [...s.grid.cells];
  dla.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});
