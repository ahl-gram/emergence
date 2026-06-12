import { test } from "node:test";
import assert from "node:assert/strict";
import { grayScott, GRAY_SCOTT_WORLD, type GrayScottState } from "../sims/grayScott.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(grayScott.params);

function run(state: GrayScottState, steps: number, p: Params = P): GrayScottState {
  let s = state;
  for (let i = 0; i < steps; i++) s = grayScott.step(s, p);
  return s;
}

function variance(cells: Float32Array): number {
  let mean = 0;
  for (const v of cells) mean += v;
  mean /= cells.length;
  let sq = 0;
  for (const v of cells) sq += (v - mean) ** 2;
  return sq / cells.length;
}

test("an unseeded uniform field stays exactly uniform", () => {
  const p: Params = { ...P, seeds: 0 };
  let s = grayScott.init(1, p);
  s = run(s, 50, p);
  const first = s.u.cells[0];
  for (const v of s.u.cells) assert.equal(v, first);
  for (const v of s.v.cells) assert.equal(v, 0);
});

test("seeded fields break symmetry and form persistent structure", () => {
  let s = grayScott.init(1, P);
  s = run(s, 600);
  const varV = variance(s.v.cells);
  assert.ok(varV > 0.001, `expected spatial structure, variance is ${varV}`);
  const st = grayScott.stats(s, P);
  assert.ok(st.coverage > 1, `pattern should cover some of the field, got ${st.coverage}%`);
  assert.ok(st.coverage < 99, "pattern should not saturate everything");
});

test("concentrations stay finite and within physical bounds", () => {
  let s = grayScott.init(3, P);
  s = run(s, 400);
  for (const v of s.u.cells) {
    assert.ok(Number.isFinite(v) && v > -0.1 && v < 1.5, `u out of range: ${v}`);
  }
  for (const v of s.v.cells) {
    assert.ok(Number.isFinite(v) && v > -0.1 && v < 1.5, `v out of range: ${v}`);
  }
});

test("same seed grows the same pattern", () => {
  const a = run(grayScott.init(7, P), 200);
  const b = run(grayScott.init(7, P), 200);
  assert.deepEqual([...a.v.cells], [...b.v.cells]);
});

test("step does not mutate the previous state", () => {
  const s = grayScott.init(5, P);
  const before = [...s.v.cells];
  grayScott.step(s, P);
  assert.deepEqual([...s.v.cells], before);
});

test("pointer injection adds chemical V", () => {
  const p: Params = { ...P, seeds: 0 };
  const s = grayScott.init(1, p);
  const painted = grayScott.onPointer!(s, 0.5, 0.5, 1, p) as GrayScottState;
  const cx = GRAY_SCOTT_WORLD.w >> 1;
  const cy = GRAY_SCOTT_WORLD.h >> 1;
  assert.equal(painted.v.cells[cy * GRAY_SCOTT_WORLD.w + cx], 1);
});
