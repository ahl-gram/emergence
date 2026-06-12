import { test } from "node:test";
import assert from "node:assert/strict";
import { gas, GasState } from "../sims/gas.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(gas.params);

function run(state: GasState, steps: number, p: Params = P): GasState {
  let s = state;
  for (let i = 0; i < steps; i++) s = gas.step(s, p);
  return s;
}

function energy(s: GasState): number {
  let e = 0;
  for (let i = 0; i < s.vx.length; i++) e += s.vx[i] ** 2 + s.vy[i] ** 2;
  return e;
}

test("kinetic energy is conserved through collisions and wall bounces", () => {
  let s = gas.init(42, P);
  const e0 = energy(s);
  for (let i = 0; i < 300; i++) {
    s = gas.step(s, P);
    assert.ok(Math.abs(energy(s) - e0) < e0 * 1e-3, `energy drifted at tick ${s.tick}`);
  }
});

test("particles stay inside the box", () => {
  let s = gas.init(7, P);
  s = run(s, 200);
  for (let i = 0; i < s.x.length; i++) {
    assert.ok(s.x[i] >= 0 && s.x[i] <= 600);
    assert.ok(s.y[i] >= 0 && s.y[i] <= 440);
  }
});

test("thermalization: a single starting speed spreads into a distribution", () => {
  let s = gas.init(1, P);
  assert.ok(gas.stats(s, P).speedSpread < 1e-4, "all speeds should start identical");
  s = run(s, 400);
  assert.ok(gas.stats(s, P).speedSpread > 0.5, `speeds should spread out, got ${gas.stats(s, P).speedSpread}`);
});

test("mean speed stays positive and finite", () => {
  let s = gas.init(3, P);
  s = run(s, 200);
  const st = gas.stats(s, P);
  assert.ok(st.meanSpeed > 0 && Number.isFinite(st.meanSpeed));
});

test("same seed replays the same gas", () => {
  const a = run(gas.init(5, P), 100);
  const b = run(gas.init(5, P), 100);
  assert.deepEqual([...a.x], [...b.x]);
  assert.deepEqual([...a.vx], [...b.vx]);
});

test("step does not mutate the previous state", () => {
  const s = gas.init(9, P);
  const x = [...s.x];
  const vx = [...s.vx];
  gas.step(s, P);
  assert.deepEqual([...s.x], x);
  assert.deepEqual([...s.vx], vx);
});
