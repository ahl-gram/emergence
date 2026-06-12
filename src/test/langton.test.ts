import { test } from "node:test";
import assert from "node:assert/strict";
import { langton, LANGTON_WORLD, type LangtonState } from "../sims/langton.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(langton.params);

function run(state: LangtonState, steps: number, p = P): LangtonState {
  let s = state;
  for (let i = 0; i < steps; i++) s = langton.step(s, p);
  return s;
}

test("first step: turn right on dark, flip cell, move east", () => {
  const s = langton.init(1, P);
  const ant = s.ants[0];
  const next = langton.step(s, P);
  assert.equal(next.ants[0].dir, 1, "north + right turn = east");
  assert.equal(next.ants[0].x, ant.x + 1);
  assert.equal(next.ants[0].y, ant.y);
  assert.equal(next.grid.cells[ant.y * LANGTON_WORLD.w + ant.x], 1, "origin cell flipped");
});

test("second step lands on dark again: turns right to south", () => {
  const s = run(langton.init(1, P), 2);
  assert.equal(s.ants[0].dir, 2);
});

test("each step flips exactly one cell per ant (parity invariant)", () => {
  let s = langton.init(1, P);
  let prev = langton.stats(s, P).flippedCells;
  for (let i = 0; i < 50; i++) {
    s = langton.step(s, P);
    const now = langton.stats(s, P).flippedCells;
    assert.equal(Math.abs(now - prev), 1);
    prev = now;
  }
});

test("the classic run is exactly reproducible (golden)", () => {
  const s = run(langton.init(1, P), 11000);
  // captured from the first verified run; locks the rule implementation
  assert.equal(langton.stats(s, P).flippedCells, GOLDEN_11000);
});

test("multiple ants are deterministic and stay in bounds", () => {
  const p = { ...P, antCount: 8 };
  const a = run(langton.init(9, p), 500, p);
  const b = run(langton.init(9, p), 500, p);
  assert.deepEqual(a.ants, b.ants);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
  for (const ant of a.ants) {
    assert.ok(ant.x >= 0 && ant.x < LANGTON_WORLD.w);
    assert.ok(ant.y >= 0 && ant.y < LANGTON_WORLD.h);
  }
});

test("step does not mutate the previous state", () => {
  const s = langton.init(1, P);
  const before = [...s.grid.cells];
  const antBefore = { ...s.ants[0] };
  langton.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
  assert.deepEqual(s.ants[0], antBefore);
});

// 834 flipped cells at step 11000 (verified run, seed-independent: single ant
// always starts centered heading north). Ant displacement at that point is ~37
// cells — the highway phase has begun, right on schedule.
const GOLDEN_11000 = 834;
