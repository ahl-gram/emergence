import { test } from "node:test";
import assert from "node:assert/strict";
import { gravity, type GravityState } from "../sims/gravity.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(gravity.params);

function run(state: GravityState, steps: number, p: Params = P): GravityState {
  let s = state;
  for (let i = 0; i < steps; i++) s = gravity.step(s, p);
  return s;
}

test("total momentum stays (numerically) zero — Newton's third law", () => {
  let s = gravity.init(42, P);
  s = run(s, 200);
  assert.ok(
    gravity.stats(s, P).momentumDrift < 1e-9,
    `equal-and-opposite forces must conserve momentum, drift = ${gravity.stats(s, P).momentumDrift}`,
  );
});

test("the center of mass does not wander", () => {
  let s = gravity.init(7, P);
  const cx0 = s.bodies.reduce((a, b) => a + b.x, 0) / s.bodies.length;
  s = run(s, 300);
  const cx1 = s.bodies.reduce((a, b) => a + b.x, 0) / s.bodies.length;
  assert.ok(Math.abs(cx1 - cx0) < 1, `center of mass moved ${Math.abs(cx1 - cx0)}`);
});

test("a spinless cloud collapses: near-pair count explodes", () => {
  const p: Params = { ...P, spin: 0 };
  let s = gravity.init(1, p);
  const start = gravity.stats(s, p).clumping;
  s = run(s, 250, p);
  const end = gravity.stats(s, p).clumping;
  assert.ok(end > start * 3, `radial collapse should clump hard: ${start.toFixed(2)} -> ${end.toFixed(2)}`);
});

test("a spinning disk still clumps, gently", () => {
  let s = gravity.init(1, P);
  const start = gravity.stats(s, P).clumping;
  s = run(s, 500);
  const end = gravity.stats(s, P).clumping;
  assert.ok(end > start * 1.5, `disk should coarsen: ${start.toFixed(2)} -> ${end.toFixed(2)}`);
});

test("all positions and velocities stay finite", () => {
  let s = gravity.init(3, P);
  s = run(s, 300);
  for (const b of s.bodies) {
    assert.ok(
      Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy),
    );
  }
});

test("same seed replays the same universe", () => {
  const a = run(gravity.init(5, P), 100);
  const b = run(gravity.init(5, P), 100);
  assert.deepEqual(a.bodies, b.bodies);
});

test("step does not mutate the previous state", () => {
  const s = gravity.init(9, P);
  const before = s.bodies.map((b) => ({ ...b }));
  gravity.step(s, P);
  assert.deepEqual(s.bodies, before);
});
