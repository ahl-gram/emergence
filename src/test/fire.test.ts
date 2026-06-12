import { test } from "node:test";
import assert from "node:assert/strict";
import { fire, EMPTY, TREE, BURNING, type FireState } from "../sims/fire.js";
import { makeGrid, idx } from "../core/grid.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(fire.params);

function tally(s: FireState): Record<number, number> {
  const out: Record<number, number> = { [EMPTY]: 0, [TREE]: 0, [BURNING]: 0 };
  for (const v of s.grid.cells) out[v] = (out[v] ?? 0) + 1;
  return out;
}

test("every cell is always in a valid state", () => {
  let s = fire.init(42, P);
  for (let i = 0; i < 30; i++) {
    s = fire.step(s, P);
    const t = tally(s);
    assert.equal(t[EMPTY] + t[TREE] + t[BURNING], s.grid.cells.length);
  }
});

test("same seed replays the same forest", () => {
  let a = fire.init(8, P);
  let b = fire.init(8, P);
  for (let i = 0; i < 40; i++) {
    a = fire.step(a, P);
    b = fire.step(b, P);
  }
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
});

test("with no growth or lightning, a full forest burns down completely", () => {
  const noChance = { ...P, growth: 0, lightning: 0 };
  const grid = makeGrid(40, 30);
  grid.cells.fill(TREE);
  for (let y = 0; y < 30; y++) grid.cells[idx(grid, 0, y)] = BURNING;
  let s: FireState = { grid, rngState: 1, tick: 0 };

  let burned = false;
  for (let i = 0; i < 60; i++) {
    s = fire.step(s, noChance);
    const t = tally(s);
    if (t[BURNING] === 0) {
      assert.equal(t[TREE], 0, "fire front should consume every tree");
      burned = true;
      break;
    }
  }
  assert.ok(burned, "fire should burn out within the step budget");
});

test("burning cells always extinguish next step", () => {
  const grid = makeGrid(10, 10);
  grid.cells[idx(grid, 5, 5)] = BURNING;
  const s: FireState = { grid, rngState: 1, tick: 0 };
  const next = fire.step(s, { ...P, growth: 0, lightning: 0 });
  assert.equal(next.grid.cells[idx(grid, 5, 5)], EMPTY);
});

test("growth repopulates an empty world", () => {
  const growOnly = { ...P, density: 0, growth: 0.05, lightning: 0 };
  let s = fire.init(3, growOnly);
  assert.equal(tally(s)[TREE], 0);
  for (let i = 0; i < 30; i++) s = fire.step(s, growOnly);
  assert.ok(tally(s)[TREE] > 0, "trees should sprout");
});

test("step does not mutate the previous state", () => {
  const s = fire.init(11, P);
  const before = [...s.grid.cells];
  fire.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});
