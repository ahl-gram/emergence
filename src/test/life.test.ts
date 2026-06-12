import { test } from "node:test";
import assert from "node:assert/strict";
import { life, type LifeState } from "../sims/life.js";
import { makeGrid, idx } from "../core/grid.js";
import { defaultParams } from "../core/types.js";

function stateFromCells(w: number, h: number, alive: Array<[number, number]>): LifeState {
  const grid = makeGrid(w, h);
  for (const [x, y] of alive) grid.cells[idx(grid, x, y)] = 1;
  return { grid, generation: 0, rngState: 0 };
}

function aliveSet(s: LifeState): Set<string> {
  const out = new Set<string>();
  for (let y = 0; y < s.grid.h; y++) {
    for (let x = 0; x < s.grid.w; x++) {
      if (s.grid.cells[idx(s.grid, x, y)] === 1) out.add(`${x},${y}`);
    }
  }
  return out;
}

const P = defaultParams(life.params);

test("blinker oscillates with period 2", () => {
  const horizontal = stateFromCells(16, 16, [[7, 7], [8, 7], [9, 7]]);
  const afterOne = life.step(horizontal, P);
  assert.deepEqual(aliveSet(afterOne), new Set(["8,6", "8,7", "8,8"]));
  const afterTwo = life.step(afterOne, P);
  assert.deepEqual(aliveSet(afterTwo), aliveSet(horizontal));
});

test("block is a still life", () => {
  const block = stateFromCells(16, 16, [[5, 5], [6, 5], [5, 6], [6, 6]]);
  const next = life.step(block, P);
  assert.deepEqual(aliveSet(next), aliveSet(block));
});

test("empty grid stays empty", () => {
  const empty = stateFromCells(16, 16, []);
  const next = life.step(empty, P);
  assert.equal(aliveSet(next).size, 0);
});

test("step does not mutate the previous state", () => {
  const s = stateFromCells(16, 16, [[7, 7], [8, 7], [9, 7]]);
  const before = [...s.grid.cells];
  life.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});

test("same seed replays the same run", () => {
  let a = life.init(42, P);
  let b = life.init(42, P);
  for (let i = 0; i < 50; i++) {
    a = life.step(a, P);
    b = life.step(b, P);
  }
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
  assert.equal(a.generation, 50);
});

test("population stat matches actual live-cell count", () => {
  const s = stateFromCells(16, 16, [[1, 1], [2, 2], [3, 3]]);
  assert.equal(life.stats(s, P).population, 3);
});

test("init density 0 gives empty grid, density 1 gives full grid", () => {
  const empty = life.init(1, { ...P, density: 0 });
  assert.equal(life.stats(empty, P).population, 0);
  const full = life.init(1, { ...P, density: 1 });
  assert.equal(life.stats(full, P).population, full.grid.w * full.grid.h);
});
