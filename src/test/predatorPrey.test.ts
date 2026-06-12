import { test } from "node:test";
import assert from "node:assert/strict";
import { predatorPrey, type PpState } from "../sims/predatorPrey.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(predatorPrey.params);

function run(state: PpState, steps: number, p = P): PpState {
  let s = state;
  for (let i = 0; i < steps; i++) s = predatorPrey.step(s, p);
  return s;
}

test("same seed replays the same ecosystem", () => {
  const a = run(predatorPrey.init(1, P), 100);
  const b = run(predatorPrey.init(1, P), 100);
  assert.deepEqual(a.sheep, b.sheep);
  assert.deepEqual(a.wolves, b.wolves);
  assert.deepEqual([...a.grass.cells], [...b.grass.cells]);
});

test("populations never go negative and agents stay in bounds", () => {
  let s = predatorPrey.init(2, P);
  for (let i = 0; i < 200; i++) {
    s = predatorPrey.step(s, P);
    for (const a of [...s.sheep, ...s.wolves]) {
      assert.ok(a.x >= 0 && a.x < 120 && a.y >= 0 && a.y < 80);
      assert.ok(a.energy > 0, "dead agents must be removed");
    }
  }
});

test("with no wolves, sheep find a carrying capacity (no unbounded growth)", () => {
  const p = { ...P, wolves0: 0 };
  let s = predatorPrey.init(3, p);
  s = run(s, 500, p);
  const cells = 120 * 80;
  assert.ok(s.sheep.length > 0, "sheep should not go extinct without predators");
  assert.ok(s.sheep.length < cells, `sheep should be grass-limited, got ${s.sheep.length}`);
});

test("default ecosystem sustains all three populations for 600 steps", () => {
  let s = predatorPrey.init(1, P);
  s = run(s, 600);
  const st = predatorPrey.stats(s, P);
  assert.ok(st.sheep > 0, "sheep went extinct");
  assert.ok(st.wolves > 0, "wolves went extinct");
  assert.ok(st.grassPct > 0, "grass disappeared");
});

test("wolves starve without prey", () => {
  const p = { ...P, sheep0: 50, wolves0: 100, wolfGain: 5 };
  let s = predatorPrey.init(4, p);
  s = run(s, 400, p);
  assert.equal(s.wolves.length, 0, "wolves should starve after eating out a tiny flock");
});

test("step does not mutate the previous state", () => {
  const s = predatorPrey.init(5, P);
  const sheepBefore = s.sheep.map((a) => ({ ...a }));
  const grassBefore = [...s.grass.cells];
  predatorPrey.step(s, P);
  assert.deepEqual(s.sheep, sheepBefore);
  assert.deepEqual([...s.grass.cells], grassBefore);
});
