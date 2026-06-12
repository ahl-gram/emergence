import { test } from "node:test";
import assert from "node:assert/strict";
import { boids, BOIDS_WORLD, type BoidsState } from "../sims/boids.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(boids.params);

function run(state: BoidsState, steps: number, p = P): BoidsState {
  let s = state;
  for (let i = 0; i < steps; i++) s = boids.step(s, p);
  return s;
}

test("same seed replays the same flock", () => {
  const a = run(boids.init(42, P), 100);
  const b = run(boids.init(42, P), 100);
  assert.deepEqual(a.boids, b.boids);
});

test("speeds stay within [minSpeed, maxSpeed]", () => {
  let s = boids.init(7, P);
  for (let i = 0; i < 50; i++) {
    s = boids.step(s, P);
    for (const b of s.boids) {
      const speed = Math.hypot(b.vx, b.vy);
      assert.ok(speed <= P.maxSpeed + 1e-9, `too fast: ${speed}`);
      assert.ok(speed >= P.maxSpeed * 0.45 - 1e-9, `too slow: ${speed}`);
    }
  }
});

test("positions stay inside the world", () => {
  let s = boids.init(9, P);
  s = run(s, 200);
  for (const b of s.boids) {
    assert.ok(b.x >= 0 && b.x < BOIDS_WORLD.w);
    assert.ok(b.y >= 0 && b.y < BOIDS_WORLD.h);
  }
});

test("step does not mutate the previous state", () => {
  const s = boids.init(11, P);
  const firstBefore = { ...s.boids[0] };
  boids.step(s, P);
  assert.deepEqual(s.boids[0], firstBefore);
});

test("alignment produces order: polarization rises from near zero", () => {
  const p = { ...P, count: 200, separation: 0.4, alignment: 1.5, cohesion: 0.4 };
  let s = boids.init(5, p);
  const start = boids.stats(s, p).polarization;
  assert.ok(start < 0.4, `random start should be disordered, got ${start}`);
  s = run(s, 600, p);
  const end = boids.stats(s, p).polarization;
  assert.ok(end > 0.7, `flock should align, got ${end}`);
});

test("polarization of a perfectly aligned flock is 1", () => {
  const aligned: BoidsState = {
    boids: Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 50, vx: 2, vy: 0 })),
    rngState: 0,
    tick: 0,
  };
  assert.ok(Math.abs(boids.stats(aligned, P).polarization - 1) < 1e-9);
});
