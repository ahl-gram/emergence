import { test } from "node:test";
import assert from "node:assert/strict";
import { spirals, SPIRALS_WORLD, type SpiralsState } from "../sims/spirals.js";
import { makeGrid, idx } from "../core/grid.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(spirals.params);
const { w: W, h: H } = SPIRALS_WORLD;

function run(state: SpiralsState, steps: number, p: Params = P): SpiralsState {
  let s = state;
  for (let i = 0; i < steps; i++) s = spirals.step(s, p);
  return s;
}

test("states always stay below K", () => {
  let s = spirals.init(42, P);
  for (let i = 0; i < 30; i++) {
    s = spirals.step(s, P);
    for (const v of s.grid.cells) assert.ok(v >= 0 && v < P.states);
  }
});

test("a uniform world is frozen — excitation must be handed to you", () => {
  const grid = makeGrid(W, H);
  grid.cells.fill(3);
  const s: SpiralsState = { grid, rngState: 0, tick: 0, advancedLastStep: 0 };
  const next = spirals.step(s, P);
  assert.deepEqual([...next.grid.cells], [...s.grid.cells]);
  assert.equal(next.advancedLastStep, 0);
});

test("a single excited cell drags its neighborhood forward", () => {
  const grid = makeGrid(W, H);
  grid.cells[idx(grid, 50, 50)] = 1; // one cell a phase ahead of the sea of 0s
  const s: SpiralsState = { grid, rngState: 0, tick: 0, advancedLastStep: 0 };
  const next = spirals.step(s, P);
  assert.equal(next.grid.cells[idx(grid, 49, 50)], 1, "neighbor should advance to 1");
  assert.equal(next.grid.cells[idx(grid, 50, 50)], 1, "the seed has nobody ahead, stays put");
});

test("from noise, the medium reaches sustained high activity (spiral regime)", () => {
  let s = spirals.init(1, P);
  s = run(s, 400);
  const late = spirals.stats(s, P).activity;
  assert.ok(late > 0.5, `spiral regime should keep most cells advancing, got ${late}`);
});

test("activity never exceeds 1 and counts match the grid", () => {
  let s = spirals.init(5, P);
  for (let i = 0; i < 20; i++) {
    s = spirals.step(s, P);
    const a = spirals.stats(s, P).activity;
    assert.ok(a >= 0 && a <= 1);
  }
});

test("same seed replays the same waves", () => {
  const a = run(spirals.init(7, P), 100);
  const b = run(spirals.init(7, P), 100);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
});

test("step does not mutate the previous state", () => {
  const s = spirals.init(9, P);
  const before = [...s.grid.cells];
  spirals.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});
