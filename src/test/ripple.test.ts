import { test } from "node:test";
import assert from "node:assert/strict";
import { ripple, RIPPLE_WORLD, rippleBarrier, type RippleState } from "../sims/ripple.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(ripple.params);
const { w: W, h: H } = RIPPLE_WORLD;

function run(state: RippleState, steps: number, p: Params = P): RippleState {
  let s = state;
  for (let i = 0; i < steps; i++) s = ripple.step(s, p);
  return s;
}

function maxAbs(u: Float32Array): number {
  let m = 0;
  for (const v of u) m = Math.max(m, Math.abs(v));
  return m;
}

test("a still field with no source stays still", () => {
  const p: Params = { ...P, slits: 0, frequency: 0 };
  const s = run(ripple.init(1, p), 50, p);
  // frequency 0 -> sin(0)=0 source; nothing should ring up
  assert.ok(maxAbs(s.u) < 1e-6, `field should stay flat, max=${maxAbs(s.u)}`);
});

test("the simulation stays bounded (CFL-stable) over a long run", () => {
  let s = ripple.init(1, P);
  for (let i = 0; i < 1500; i++) {
    s = ripple.step(s, P);
    if (i % 300 === 0) assert.ok(maxAbs(s.u) < 5, `amplitude blew up to ${maxAbs(s.u)} at step ${i}`);
  }
});

test("the source launches waves that travel across the field", () => {
  // wave speed ~0.42 cell/step, so reaching the far side past the barrier
  // through the slits takes a few hundred steps
  const s = run(ripple.init(1, P), 700);
  let rightEnergy = 0;
  for (let y = 20; y < H - 20; y++) {
    for (let x = W - 80; x < W - 20; x++) rightEnergy += s.u[y * W + x] ** 2;
  }
  assert.ok(rightEnergy > 0.5, `waves should reach the far side, energy=${rightEnergy.toFixed(3)}`);
});

test("the barrier blocks the wave except at the slits", () => {
  const b = rippleBarrier(2, 34, 2);
  const bx = Math.floor(W * 0.34);
  let wall = 0;
  let open = 0;
  for (let y = 0; y < H; y++) {
    if (b[y * W + bx] === 1) wall++;
    else open++;
  }
  assert.ok(wall > 0, "there should be a wall");
  assert.ok(open > 0, "there should be slit openings");
  // two slits of half-width 2 => about 2*(2*2+1)=10 open cells
  assert.ok(open >= 8 && open <= 14, `two slits should open ~10 cells, got ${open}`);
});

test("barrier cells never carry wave amplitude", () => {
  let s = ripple.init(1, P);
  for (let i = 0; i < 300; i++) {
    s = ripple.step(s, P);
    for (let k = 0; k < s.barrier.length; k++) {
      if (s.barrier[k]) assert.equal(s.u[k], 0);
    }
  }
});

test("more slits change the far-field pattern", () => {
  const one = run(ripple.init(1, { ...P, slits: 1 }), 300, { ...P, slits: 1 });
  const two = run(ripple.init(1, { ...P, slits: 2 }), 300, { ...P, slits: 2 });
  assert.notDeepEqual([...one.u], [...two.u]);
});

test("same seed and params replay the same field", () => {
  const a = run(ripple.init(1, P), 200);
  const b = run(ripple.init(1, P), 200);
  assert.deepEqual([...a.u], [...b.u]);
});

test("step does not mutate the previous state", () => {
  const s = run(ripple.init(1, P), 30);
  const before = [...s.u];
  ripple.step(s, P);
  assert.deepEqual([...s.u], before);
});
