import { test } from "node:test";
import assert from "node:assert/strict";
import { ising, T_CRITICAL, type IsingState } from "../sims/ising.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(ising.params);
const ORDERED: Params = { ...P, start: 1 };

function run(state: IsingState, steps: number, p: Params): IsingState {
  let s = state;
  for (let i = 0; i < steps; i++) s = ising.step(s, p);
  return s;
}

test("critical temperature constant is the Onsager value", () => {
  assert.ok(Math.abs(T_CRITICAL - 2.269) < 0.001);
});

test("cold magnet stays ordered: |m| > 0.95 at T=1", () => {
  const p: Params = { ...ORDERED, T: 1 };
  const s = run(ising.init(1, p), 200, p);
  assert.ok(Math.abs(ising.stats(s, p).magnetization) > 0.95);
});

test("hot magnet melts: |m| < 0.2 within 30 sweeps at T=5", () => {
  const p: Params = { ...ORDERED, T: 5 };
  const s = run(ising.init(1, p), 30, p);
  assert.ok(Math.abs(ising.stats(s, p).magnetization) < 0.2);
});

test("magnetization and energy stay within physical bounds", () => {
  let s = ising.init(7, P);
  for (let i = 0; i < 20; i++) {
    s = ising.step(s, P);
    const st = ising.stats(s, P);
    assert.ok(st.magnetization >= -1 && st.magnetization <= 1);
    assert.ok(st.energy >= -2 && st.energy <= 2);
  }
});

test("all-up start has m = 1 and ground-state energy -2", () => {
  const s = ising.init(1, ORDERED);
  const st = ising.stats(s, ORDERED);
  assert.equal(st.magnetization, 1);
  assert.equal(st.energy, -2);
});

test("same seed replays the same magnet", () => {
  const a = run(ising.init(5, P), 30, P);
  const b = run(ising.init(5, P), 30, P);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
});

test("step does not mutate the previous state", () => {
  const s = ising.init(9, P);
  const before = [...s.grid.cells];
  ising.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});
