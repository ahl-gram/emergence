import { test } from "node:test";
import assert from "node:assert/strict";
import { wealth, gini, type WealthState } from "../sims/wealth.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(wealth.params);

function run(state: WealthState, steps: number, p: Params = P): WealthState {
  let s = state;
  for (let i = 0; i < steps; i++) s = wealth.step(s, p);
  return s;
}

function total(s: WealthState): number {
  return s.wealth.reduce((acc, v) => acc + v, 0);
}

test("gini of known distributions", () => {
  assert.equal(gini([100, 100, 100, 100]), 0);
  assert.ok(Math.abs(gini([0, 1]) - 0.5) < 1e-12);
  assert.ok(Math.abs(gini([0, 0, 0, 1]) - 0.75) < 1e-12);
  assert.equal(gini([]), 0);
});

test("wealth is conserved exactly, with and without tax", () => {
  for (const tax of [0, 0.03]) {
    const p: Params = { ...P, tax };
    let s = wealth.init(1, p);
    const start = total(s);
    for (let i = 0; i < 200; i++) {
      s = wealth.step(s, p);
      assert.equal(total(s), start, `leak at step ${s.tick} with tax ${tax}`);
    }
  }
});

test("equal start means Gini 0", () => {
  const s = wealth.init(1, P);
  assert.equal(gini(s.wealth), 0);
});

test("fair coin flips still condense wealth: Gini exceeds 0.8", () => {
  const s = run(wealth.init(1, P), 1500);
  assert.ok(gini(s.wealth) > 0.8, `gini = ${gini(s.wealth)}`);
});

test("a small flat tax holds inequality far below condensation", () => {
  const taxed: Params = { ...P, tax: 0.04 };
  const s = run(wealth.init(1, taxed), 1500, taxed);
  const g = gini(s.wealth);
  assert.ok(g < 0.4, `taxed gini should stay moderate, got ${g}`);
});

test("nobody's wealth goes negative", () => {
  let s = wealth.init(3, P);
  for (let i = 0; i < 500; i++) {
    s = wealth.step(s, P);
    for (const v of s.wealth) assert.ok(v >= 0);
  }
});

test("same seed replays the same economy", () => {
  const a = run(wealth.init(5, P), 300);
  const b = run(wealth.init(5, P), 300);
  assert.deepEqual(a.wealth, b.wealth);
});

test("step does not mutate the previous state", () => {
  const s = wealth.init(7, P);
  const before = [...s.wealth];
  wealth.step(s, P);
  assert.deepEqual([...s.wealth], before);
});
