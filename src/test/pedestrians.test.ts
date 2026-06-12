import { test } from "node:test";
import assert from "node:assert/strict";
import { pedestrians, PED_WORLD, type PedestriansState } from "../sims/pedestrians.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(pedestrians.params);

function run(state: PedestriansState, steps: number, p: Params = P): PedestriansState {
  let s = state;
  for (let i = 0; i < steps; i++) s = pedestrians.step(s, p);
  return s;
}

test("walker counts per direction are conserved", () => {
  const start = pedestrians.init(42, P);
  const rightBefore = start.walkers.filter((w) => w.dir === 1).length;
  const end = run(start, 150);
  assert.equal(end.walkers.length, start.walkers.length);
  assert.equal(end.walkers.filter((w) => w.dir === 1).length, rightBefore);
});

test("no two walkers ever share a cell", () => {
  let s = pedestrians.init(7, P);
  for (let i = 0; i < 100; i++) {
    s = pedestrians.step(s, P);
    const seen = new Set(s.walkers.map((w) => w.y * PED_WORLD.w + w.x));
    assert.equal(seen.size, s.walkers.length, `overlap at tick ${s.tick}`);
  }
});

test("walkers stay inside the corridor", () => {
  const s = run(pedestrians.init(9, P), 150);
  for (const w of s.walkers) {
    assert.ok(w.x >= 0 && w.x < PED_WORLD.w);
    assert.ok(w.y >= 0 && w.y < PED_WORLD.h);
  }
});

test("lanes form: order parameter rises substantially", () => {
  let s = pedestrians.init(1, P);
  const start = pedestrians.stats(s, P).laneOrder;
  s = run(s, 400);
  const end = pedestrians.stats(s, P).laneOrder;
  assert.ok(end > start + 0.2, `lane order should rise: ${start.toFixed(3)} -> ${end.toFixed(3)}`);
  assert.ok(end > 0.5, `corridor should be visibly laned, got ${end.toFixed(3)}`);
});

test("sparse corridors flow freely", () => {
  const p: Params = { ...P, density: 0.05 };
  const s = run(pedestrians.init(3, p), 100, p);
  assert.ok(pedestrians.stats(s, p).flow > 0.85, "nearly everyone should advance each step");
});

test("same seed replays the same crowd", () => {
  const a = run(pedestrians.init(5, P), 80);
  const b = run(pedestrians.init(5, P), 80);
  assert.deepEqual(a.walkers, b.walkers);
});

test("step does not mutate the previous state", () => {
  const s = pedestrians.init(11, P);
  const before = s.walkers.map((w) => ({ ...w }));
  pedestrians.step(s, P);
  assert.deepEqual(s.walkers, before);
});
