import { test } from "node:test";
import assert from "node:assert/strict";
import { schelling, type SchellingState } from "../sims/schelling.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(schelling.params);

function counts(s: SchellingState): [number, number, number] {
  let empty = 0, a = 0, b = 0;
  for (const v of s.grid.cells) {
    if (v === 0) empty++;
    else if (v === 1) a++;
    else b++;
  }
  return [empty, a, b];
}

function run(state: SchellingState, steps: number): SchellingState {
  let s = state;
  for (let i = 0; i < steps; i++) s = schelling.step(s, P);
  return s;
}

test("agents are conserved across moves", () => {
  const start = schelling.init(42, P);
  const before = counts(start);
  const after = counts(run(start, 50));
  assert.deepEqual(after, before);
});

test("same seed replays the same city", () => {
  const a = run(schelling.init(3, P), 40);
  const b = run(schelling.init(3, P), 40);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
});

test("mild preference segregates: similarity climbs well above start", () => {
  let s = schelling.init(3, P);
  const startSim = schelling.stats(s, P).similarity;
  assert.ok(startSim > 0.4 && startSim < 0.6, `random mix should start near 0.5, got ${startSim}`);
  s = run(s, 80);
  const endSim = schelling.stats(s, P).similarity;
  assert.ok(endSim > startSim + 0.1, `similarity should rise, ${startSim} -> ${endSim}`);
  assert.ok(endSim > 0.62, `30% preference typically yields >62% similarity, got ${endSim}`);
});

test("step does not mutate the previous state", () => {
  const s = schelling.init(7, P);
  const before = [...s.grid.cells];
  schelling.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});

test("stats are well-formed fractions", () => {
  const s = run(schelling.init(5, P), 10);
  const st = schelling.stats(s, P);
  assert.ok(st.similarity >= 0 && st.similarity <= 1);
  assert.ok(st.happy >= 0 && st.happy <= 1);
  assert.ok(st.moved >= 0);
});
