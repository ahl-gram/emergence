import { test } from "node:test";
import assert from "node:assert/strict";
import { brain, OFF, FIRING, REFRACTORY, BRAIN_WORLD, type BrainState } from "../sims/brain.js";
import { makeGrid, idx } from "../core/grid.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(brain.params);
const { w: W, h: H } = BRAIN_WORLD;

function fromCells(firing: Array<[number, number]>): BrainState {
  const grid = makeGrid(W, H);
  for (const [x, y] of firing) grid.cells[idx(grid, x, y)] = FIRING;
  return { grid, rngState: 0, tick: 0 };
}

function run(state: BrainState, steps: number): BrainState {
  let s = state;
  for (let i = 0; i < steps; i++) s = brain.step(s, P);
  return s;
}

test("a firing cell becomes refractory, then off", () => {
  const s = fromCells([[50, 50]]);
  const one = brain.step(s, P);
  assert.equal(one.grid.cells[idx(one.grid, 50, 50)], REFRACTORY);
  const two = brain.step(one, P);
  assert.equal(two.grid.cells[idx(two.grid, 50, 50)], OFF);
});

test("an off cell ignites only with exactly two firing neighbors", () => {
  const two = brain.step(fromCells([[49, 50], [51, 50]]), P);
  assert.equal(two.grid.cells[idx(two.grid, 50, 50)], FIRING, "2 neighbors should ignite");

  const one = brain.step(fromCells([[49, 50]]), P);
  assert.equal(one.grid.cells[idx(one.grid, 50, 50)], OFF, "1 neighbor should not");

  const three = brain.step(fromCells([[49, 50], [51, 50], [50, 49]]), P);
  assert.equal(three.grid.cells[idx(three.grid, 50, 50)], OFF, "3 neighbors should not");
});

test("cells are always in a valid state", () => {
  let s = brain.init(42, P);
  for (let i = 0; i < 30; i++) {
    s = brain.step(s, P);
    for (const v of s.grid.cells) assert.ok(v === OFF || v === FIRING || v === REFRACTORY);
  }
});

test("activity persists: the sky keeps burning for 500 steps", () => {
  let s = brain.init(1, P);
  s = run(s, 500);
  assert.ok(brain.stats(s, P).firing > 0, "Brian's Brain should not die out");
});

test("an empty world stays empty", () => {
  const s = run(fromCells([]), 5);
  assert.ok(s.grid.cells.every((v) => v === OFF));
});

test("same seed replays the same run", () => {
  const a = run(brain.init(7, P), 100);
  const b = run(brain.init(7, P), 100);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
});

test("step does not mutate the previous state", () => {
  const s = brain.init(9, P);
  const before = [...s.grid.cells];
  brain.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});
