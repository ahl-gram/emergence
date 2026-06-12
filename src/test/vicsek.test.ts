import { test } from "node:test";
import assert from "node:assert/strict";
import { vicsek, VICSEK_WORLD, type VicsekState } from "../sims/vicsek.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(vicsek.params);

function run(state: VicsekState, steps: number, p: Params = P): VicsekState {
  let s = state;
  for (let i = 0; i < steps; i++) s = vicsek.step(s, p);
  return s;
}

test("particles stay within the periodic box", () => {
  let s = vicsek.init(42, P);
  for (let i = 0; i < 60; i++) {
    s = vicsek.step(s, P);
    for (let k = 0; k < s.x.length; k++) {
      assert.ok(s.x[k] >= 0 && s.x[k] < VICSEK_WORLD.w);
      assert.ok(s.y[k] >= 0 && s.y[k] < VICSEK_WORLD.h);
    }
  }
});

test("low noise orders the swarm", () => {
  const p: Params = { ...P, noise: 0.05, count: 800 };
  let s = vicsek.init(1, p);
  const start = vicsek.stats(s, p).order;
  s = run(s, 300, p);
  const end = vicsek.stats(s, p).order;
  assert.ok(end > 0.8, `cold swarm should flock, order=${end}`);
  assert.ok(end > start, "order should rise from a disordered start");
});

test("high noise keeps the swarm disordered", () => {
  const p: Params = { ...P, noise: 1, count: 800 };
  const s = run(vicsek.init(1, p), 300, p);
  assert.ok(vicsek.stats(s, p).order < 0.4, `hot swarm should stay gas-like, order=${vicsek.stats(s, p).order}`);
});

test("order parameter is always a valid fraction", () => {
  let s = vicsek.init(7, P);
  for (let i = 0; i < 30; i++) {
    s = vicsek.step(s, P);
    const o = vicsek.stats(s, P).order;
    assert.ok(o >= 0 && o <= 1.0001);
  }
});

test("a perfectly aligned swarm has order 1", () => {
  const n = 50;
  const s: VicsekState = {
    x: new Float32Array(n).fill(100),
    y: new Float32Array(n).fill(100),
    angle: new Float32Array(n).fill(0.7),
    rngState: 0,
    tick: 0,
  };
  assert.ok(Math.abs(vicsek.stats(s, P).order - 1) < 1e-6);
});

test("same seed replays the same swarm", () => {
  const a = run(vicsek.init(5, P), 60);
  const b = run(vicsek.init(5, P), 60);
  assert.deepEqual([...a.angle], [...b.angle]);
  assert.deepEqual([...a.x], [...b.x]);
});

test("step does not mutate the previous state", () => {
  const s = vicsek.init(9, P);
  const x = [...s.x];
  const angle = [...s.angle];
  vicsek.step(s, P);
  assert.deepEqual([...s.x], x);
  assert.deepEqual([...s.angle], angle);
});
