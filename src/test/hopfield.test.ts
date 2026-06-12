import { test } from "node:test";
import assert from "node:assert/strict";
import { hopfield, energy, HOPFIELD_PATTERNS, type HopfieldState } from "../sims/hopfield.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(hopfield.params);

function run(state: HopfieldState, steps: number, p: Params = P): HopfieldState {
  let s = state;
  for (let i = 0; i < steps; i++) s = hopfield.step(s, p);
  return s;
}

test("energy never increases under asynchronous updates", () => {
  let s = hopfield.init(1, { ...P, noise: 0.4 });
  let prev = energy(s.s);
  for (let i = 0; i < 30; i++) {
    s = hopfield.step(s, P);
    const e = energy(s.s);
    assert.ok(e <= prev + 1e-6, `energy rose from ${prev} to ${e} at sweep ${s.tick}`);
    prev = e;
    if (s.converged) break;
  }
});

test("every stored pattern is a fixed point", () => {
  for (let target = 0; target < HOPFIELD_PATTERNS.length; target++) {
    const p: Params = { ...P, target, noise: 0 };
    const s = hopfield.init(1, p);
    const next = hopfield.step(s, p);
    assert.deepEqual([...next.s], [...s.s], `memory ${target} should be stable`);
    assert.ok(next.converged);
  }
});

test("the network reconstructs a corrupted memory", () => {
  for (let target = 0; target < HOPFIELD_PATTERNS.length; target++) {
    const p: Params = { ...P, target, noise: 0.3 };
    const s = run(hopfield.init(2, p), 40, p);
    assert.ok(hopfield.stats(s, p).recall > 0.95, `memory ${target} should be recalled`);
  }
});

test("a corrupted seed really starts far from the target", () => {
  const p: Params = { ...P, target: 0, noise: 0.3 };
  const s = hopfield.init(2, p);
  const recall0 = hopfield.stats(s, p).recall;
  assert.ok(recall0 < 0.85, `30% corruption should lower overlap, got ${recall0}`);
});

test("convergence is a true fixed point — it stops flipping", () => {
  const p: Params = { ...P, noise: 0.3 };
  let s = hopfield.init(2, p);
  for (let i = 0; i < 60 && !s.converged; i++) s = hopfield.step(s, p);
  assert.ok(s.converged, "should reach a fixed point");
  const frozen = [...s.s];
  s = hopfield.step(s, p);
  assert.deepEqual([...s.s], frozen);
});

test("same seed replays the same recall", () => {
  const a = run(hopfield.init(5, P), 20);
  const b = run(hopfield.init(5, P), 20);
  assert.deepEqual([...a.s], [...b.s]);
});

test("step does not mutate the previous state", () => {
  const s = hopfield.init(7, { ...P, noise: 0.3 });
  const before = [...s.s];
  hopfield.step(s, P);
  assert.deepEqual([...s.s], before);
});
