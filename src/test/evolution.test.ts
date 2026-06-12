import { test } from "node:test";
import assert from "node:assert/strict";
import { evolution, EVOLUTION_N, BS_THRESHOLD, type EvolutionState } from "../sims/evolution.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(evolution.params);

function run(state: EvolutionState, steps: number): EvolutionState {
  let s = state;
  for (let i = 0; i < steps; i++) s = evolution.step(s, P);
  return s;
}

test("each extinction replaces exactly the weakest and its two neighbors", () => {
  const s = evolution.init(1, P);
  let weakest = 0;
  s.fitness.forEach((f, i) => {
    if (f < s.fitness[weakest]) weakest = i;
  });
  const next = evolution.step(s, P);
  const changed: number[] = [];
  for (let i = 0; i < EVOLUTION_N; i++) {
    if (next.fitness[i] !== s.fitness[i]) changed.push(i);
  }
  const expected = [
    (weakest - 1 + EVOLUTION_N) % EVOLUTION_N,
    weakest,
    (weakest + 1) % EVOLUTION_N,
  ].sort((a, b) => a - b);
  assert.deepEqual(changed, expected);
});

test("fitness values always stay in [0, 1)", () => {
  let s = evolution.init(42, P);
  s = run(s, 2000);
  for (const f of s.fitness) assert.ok(f >= 0 && f < 1);
});

test("the ecosystem self-organizes to the critical bar", () => {
  let s = evolution.init(1, P);
  const startAbove = evolution.stats(s, P).aboveBar;
  assert.ok(startAbove < 0.45, `random start should sit near 1/3 above the bar, got ${startAbove}`);
  s = run(s, 30000);
  const endAbove = evolution.stats(s, P).aboveBar;
  assert.ok(endAbove > 0.85, `after self-organization most species exceed ${BS_THRESHOLD}, got ${endAbove}`);
});

test("history is capped and marks exactly three replacements per row", () => {
  const s = run(evolution.init(3, P), 400);
  assert.ok(s.history.length <= 320);
  const lastRow = s.history[s.history.length - 1];
  let marks = 0;
  for (const v of lastRow) if (v === 255) marks++;
  assert.equal(marks, 3);
});

test("same seed replays the same fossil record", () => {
  const a = run(evolution.init(7, P), 500);
  const b = run(evolution.init(7, P), 500);
  assert.deepEqual(a.fitness, b.fitness);
});

test("step does not mutate the previous state", () => {
  const s = evolution.init(9, P);
  const before = [...s.fitness];
  evolution.step(s, P);
  assert.deepEqual([...s.fitness], before);
});
