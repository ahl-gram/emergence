import { test } from "node:test";
import assert from "node:assert/strict";
import { dilemma, COOPERATE, DEFECT, DILEMMA_WORLD, type DilemmaState } from "../sims/dilemma.js";
import { makeGrid, idx } from "../core/grid.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(dilemma.params);
const SINGLE_D: Params = { ...P, start: 1 };
const { w: W, h: H } = DILEMMA_WORLD;

function run(state: DilemmaState, steps: number, p: Params): DilemmaState {
  let s = state;
  for (let i = 0; i < steps; i++) s = dilemma.step(s, p);
  return s;
}

function uniform(strategy: number): DilemmaState {
  const grid = makeGrid(W, H);
  grid.cells.fill(strategy);
  return { grid, prev: grid, rngState: 0, tick: 0 };
}

test("a world of cooperators stays cooperative", () => {
  const s = run(uniform(COOPERATE), 10, P);
  assert.ok(s.grid.cells.every((v) => v === COOPERATE));
});

test("a world of defectors stays defective", () => {
  const s = run(uniform(DEFECT), 10, P);
  assert.ok(s.grid.cells.every((v) => v === DEFECT));
});

test("low temptation contains the outbreak: b=1.3 keeps >98% cooperation", () => {
  const p: Params = { ...SINGLE_D, b: 1.3 };
  const s = run(dilemma.init(1, p), 100, p);
  assert.ok(dilemma.stats(s, p).cooperators > 0.98);
});

test("critical temptation: b=1.85 spreads defection yet cooperation survives", () => {
  const p: Params = { ...SINGLE_D, b: 1.85 };
  const s = run(dilemma.init(1, p), 100, p);
  const c = dilemma.stats(s, p).cooperators;
  assert.ok(c < 0.99, `defection should have spread, C=${c}`);
  assert.ok(c > 0.5, `cooperation should persist in clusters, C=${c}`);
});

test("high temptation collapses cooperation: b=2.2 ends below 10%", () => {
  const p: Params = { ...SINGLE_D, b: 2.2 };
  const s = run(dilemma.init(1, p), 100, p);
  assert.ok(dilemma.stats(s, p).cooperators < 0.1);
});

test("the single-defector carpet is fourfold symmetric", () => {
  const p: Params = { ...SINGLE_D, b: 1.85 };
  const s = run(dilemma.init(1, p), 40, p);
  const cx = W >> 1;
  const cy = H >> 1;
  for (let dy = 0; dy < 20; dy++) {
    for (let dx = 0; dx < 20; dx++) {
      const v = s.grid.cells[idx(s.grid, cx + dx, cy + dy)];
      assert.equal(s.grid.cells[idx(s.grid, cx - dx, cy + dy)], v);
      assert.equal(s.grid.cells[idx(s.grid, cx + dx, cy - dy)], v);
    }
  }
});

test("deterministic: same seed and params replay the same war", () => {
  const a = run(dilemma.init(3, P), 50, P);
  const b = run(dilemma.init(3, P), 50, P);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
});

test("step does not mutate the previous state", () => {
  const s = dilemma.init(5, P);
  const before = [...s.grid.cells];
  dilemma.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});
