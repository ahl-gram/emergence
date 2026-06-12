import { test } from "node:test";
import assert from "node:assert/strict";
import { sand, AIR, WALL, SAND, WATER, SAND_WORLD, type SandState } from "../sims/sand.js";
import { makeGrid, idx } from "../core/grid.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(sand.params);
const SEALED: Params = { ...P, sandRate: 0, waterRate: 0 };
const { w: W, h: H } = SAND_WORLD;

function boxWorld(): SandState {
  const grid = makeGrid(W, H);
  for (let x = 0; x < W; x++) {
    grid.cells[idx(grid, x, 0)] = WALL;
    grid.cells[idx(grid, x, H - 1)] = WALL;
  }
  for (let y = 0; y < H; y++) {
    grid.cells[idx(grid, 0, y)] = WALL;
    grid.cells[idx(grid, W - 1, y)] = WALL;
  }
  return { grid, rngState: 1, tick: 0 };
}

function count(s: SandState, kind: number): number {
  let n = 0;
  for (const v of s.grid.cells) if (v === kind) n++;
  return n;
}

function run(state: SandState, steps: number, p = SEALED): SandState {
  let s = state;
  for (let i = 0; i < steps; i++) s = sand.step(s, p);
  return s;
}

test("a lone grain falls one cell per step", () => {
  const s = boxWorld();
  s.grid.cells[idx(s.grid, 10, 5)] = SAND;
  const next = sand.step(s, SEALED);
  assert.equal(next.grid.cells[idx(s.grid, 10, 5)], AIR);
  assert.equal(next.grid.cells[idx(s.grid, 10, 6)], SAND);
});

test("matter is conserved in a sealed box", () => {
  const s = boxWorld();
  for (let i = 0; i < 60; i++) {
    s.grid.cells[idx(s.grid, 40 + (i % 10), 10 + Math.floor(i / 10))] = SAND;
    s.grid.cells[idx(s.grid, 90 + (i % 10), 10 + Math.floor(i / 10))] = WATER;
  }
  const sand0 = count(s, SAND);
  const water0 = count(s, WATER);
  const end = run(s, 200);
  assert.equal(count(end, SAND), sand0);
  assert.equal(count(end, WATER), water0);
});

test("sand settles to a fixpoint", () => {
  const s = boxWorld();
  for (let i = 0; i < 40; i++) {
    s.grid.cells[idx(s.grid, 60 + (i % 8), 5 + Math.floor(i / 8))] = SAND;
  }
  const settled = run(s, 300);
  const oneMore = sand.step(settled, SEALED);
  assert.deepEqual([...oneMore.grid.cells], [...settled.grid.cells]);
});

test("water finds its level: a column spreads across the floor", () => {
  const s = boxWorld();
  for (let y = 100; y < 120; y++) s.grid.cells[idx(s.grid, 50, y)] = WATER;
  const end = run(s, 400);
  let bottomRowWater = 0;
  for (let x = 1; x < W - 1; x++) {
    if (end.grid.cells[idx(end.grid, x, H - 2)] === WATER) bottomRowWater++;
  }
  assert.ok(bottomRowWater >= 15, `water should spread along the floor, got ${bottomRowWater}`);
});

test("sand sinks through trapped water", () => {
  const s = boxWorld();
  // wall in the water so it cannot slide out from underneath
  s.grid.cells[idx(s.grid, 29, H - 2)] = WALL;
  s.grid.cells[idx(s.grid, 31, H - 2)] = WALL;
  s.grid.cells[idx(s.grid, 30, H - 2)] = WATER;
  s.grid.cells[idx(s.grid, 30, H - 3)] = SAND;
  const next = sand.step(s, SEALED);
  assert.equal(next.grid.cells[idx(s.grid, 30, H - 2)], SAND, "sand should displace the water");
  assert.equal(next.grid.cells[idx(s.grid, 30, H - 3)], WATER, "water should be pushed up");
});

test("pouring adds matter over time", () => {
  let s = sand.init(1, P);
  const before = count(s, SAND) + count(s, WATER);
  s = run(s, 100, P);
  assert.ok(count(s, SAND) + count(s, WATER) > before);
});

test("same seed replays the same world", () => {
  const a = run(sand.init(1, P), 120, P);
  const b = run(sand.init(1, P), 120, P);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
});

test("step does not mutate the previous state", () => {
  const s = boxWorld();
  s.grid.cells[idx(s.grid, 10, 5)] = SAND;
  const before = [...s.grid.cells];
  sand.step(s, SEALED);
  assert.deepEqual([...s.grid.cells], before);
});

test("pointer paints the selected brush and right-drag erases", () => {
  const s = boxWorld();
  const painted = sand.onPointer!(s, 0.5, 0.5, 1, { ...P, brush: 2 }) as SandState;
  assert.ok(count(painted, WALL) > count(s, WALL));
  const erased = sand.onPointer!(painted, 0.5, 0.5, 2, { ...P, brush: 2 }) as SandState;
  assert.ok(count(erased, WALL) < count(painted, WALL));
});
