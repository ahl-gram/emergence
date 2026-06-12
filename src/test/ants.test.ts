import { test } from "node:test";
import assert from "node:assert/strict";
import { ants, ANTS_WORLD, type AntsState } from "../sims/ants.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(ants.params);

function run(state: AntsState, steps: number, p = P): AntsState {
  let s = state;
  for (let i = 0; i < steps; i++) s = ants.step(s, p);
  return s;
}

function totalFood(s: AntsState): number {
  let sum = 0;
  for (const v of s.food.cells) sum += v;
  return sum;
}

function carriedFood(s: AntsState): number {
  return s.ants.filter((a) => a.carrying).length;
}

test("same seed replays the same colony", () => {
  const a = run(ants.init(42, P), 200);
  const b = run(ants.init(42, P), 200);
  assert.deepEqual(a.ants, b.ants);
  assert.deepEqual([...a.pher.cells], [...b.pher.cells]);
  assert.equal(a.collected, b.collected);
});

test("food is conserved: ground + carried + delivered is constant", () => {
  let s = ants.init(7, P);
  const total = totalFood(s) + carriedFood(s) + s.collected;
  for (let i = 0; i < 300; i++) {
    s = ants.step(s, P);
    assert.equal(
      totalFood(s) + carriedFood(s) + s.collected,
      total,
      `food leaked at tick ${s.tick}`,
    );
  }
});

test("ants stay in bounds with finite headings", () => {
  let s = ants.init(9, P);
  for (let i = 0; i < 150; i++) {
    s = ants.step(s, P);
    for (const a of s.ants) {
      assert.ok(a.x >= 0 && a.x < ANTS_WORLD.w);
      assert.ok(a.y >= 0 && a.y < ANTS_WORLD.h);
      assert.ok(Number.isFinite(a.angle));
    }
  }
});

test("pheromone stays non-negative and bounded", () => {
  let s = ants.init(11, P);
  s = run(s, 300);
  for (const v of s.pher.cells) {
    assert.ok(v >= 0 && v <= 12 && Number.isFinite(v));
  }
});

test("the colony actually collects food", () => {
  let s = ants.init(1, P);
  s = run(s, 800);
  assert.ok(s.collected > 0, `expected food deliveries within 800 steps, got ${s.collected}`);
});

test("step does not mutate the previous state", () => {
  const s = ants.init(5, P);
  const foodBefore = [...s.food.cells];
  const antsBefore = s.ants.map((a) => ({ ...a }));
  ants.step(s, P);
  assert.deepEqual([...s.food.cells], foodBefore);
  assert.deepEqual(s.ants, antsBefore);
});

test("dropping food via pointer adds food without touching ants", () => {
  const s = ants.init(3, P);
  const before = totalFood(s);
  const after = ants.onPointer!(s, 0.25, 0.25, 1, P);
  assert.ok(totalFood(after as AntsState) > before);
  assert.deepEqual((after as AntsState).ants, s.ants);
});
