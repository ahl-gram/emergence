import { test } from "node:test";
import assert from "node:assert/strict";
import { sandpile, dropAndRelax, SANDPILE_WORLD, type SandpileState } from "../sims/sandpile.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(sandpile.params);
const { w: W, h: H } = SANDPILE_WORLD;

function run(state: SandpileState, steps: number, p = P): SandpileState {
  let s = state;
  for (let i = 0; i < steps; i++) s = sandpile.step(s, p);
  return s;
}

test("grains are conserved: dropped = on board + lost off edge", () => {
  let s = sandpile.init(1, P);
  for (let i = 0; i < 300; i++) {
    s = sandpile.step(s, P);
    const st = sandpile.stats(s, P);
    assert.equal(st.grains + st.lostOffEdge, s.dropped, `leak at tick ${s.tick}`);
  }
});

test("after every step the pile is fully relaxed (all cells < 4)", () => {
  let s = sandpile.init(1, P);
  s = run(s, 500);
  for (const v of s.grid.cells) assert.ok(v >= 0 && v < 4);
});

test("the sandpile is abelian: drop order does not change the result", () => {
  const a = new Int16Array(W * H);
  const b = new Int16Array(W * H);
  const drops: Array<[number, number]> = [
    [75, 50], [76, 50], [75, 51], [40, 30], [75, 50], [75, 50], [75, 50], [76, 51],
  ];
  for (const [x, y] of drops) dropAndRelax(a, x, y);
  for (const [x, y] of [...drops].reverse()) dropAndRelax(b, x, y);
  assert.deepEqual([...a], [...b]);
});

test("piling onto one cell eventually topples", () => {
  const cells = new Int16Array(W * H);
  let toppledTotal = 0;
  for (let i = 0; i < 5; i++) {
    toppledTotal += dropAndRelax(cells, 75, 50).toppled;
  }
  assert.ok(toppledTotal >= 1, "five grains on one cell must topple at least once");
  assert.ok(cells[50 * W + 75] < 4);
});

test("with spread, runs are still deterministic per seed", () => {
  const p = { ...P, spread: 10 };
  const a = run(sandpile.init(7, p), 200, p);
  const b = run(sandpile.init(7, p), 200, p);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
  assert.equal(a.lost, b.lost);
});

test("step does not mutate the previous state", () => {
  const s = run(sandpile.init(1, P), 50);
  const before = [...s.grid.cells];
  sandpile.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});

test("avalanches eventually exceed single topples (criticality builds)", () => {
  let s = sandpile.init(1, P);
  let biggest = 0;
  for (let i = 0; i < 800; i++) {
    s = sandpile.step(s, P);
    biggest = Math.max(biggest, s.lastAvalanche);
  }
  assert.ok(biggest > 50, `expected a sizable avalanche, biggest was ${biggest}`);
});
