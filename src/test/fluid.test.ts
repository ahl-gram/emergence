import { test } from "node:test";
import assert from "node:assert/strict";
import { fluid, FLUID_WORLD, fluidIsObstacle, type FluidState } from "../sims/fluid.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(fluid.params);
const { w: W, h: H } = FLUID_WORLD;
const Q = 9;
const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];

function run(state: FluidState, steps: number, p: Params = P): FluidState {
  let s = state;
  for (let i = 0; i < steps; i++) s = fluid.step(s, p);
  return s;
}

function velocity(s: FluidState, x: number, y: number): { rho: number; ux: number; uy: number } {
  const base = (y * W + x) * Q;
  let rho = 0, ux = 0, uy = 0;
  for (let i = 0; i < Q; i++) {
    const fi = s.f[base + i];
    rho += fi;
    ux += EX[i] * fi;
    uy += EY[i] * fi;
  }
  return rho > 0 ? { rho, ux: ux / rho, uy: uy / rho } : { rho, ux: 0, uy: 0 };
}

test("the simulation stays finite (no blow-up) over a long run", () => {
  let s = fluid.init(1, P);
  for (let i = 0; i < 1500; i++) {
    s = fluid.step(s, P);
    if (i % 300 === 0) {
      for (let k = 0; k < s.f.length; k++) assert.ok(Number.isFinite(s.f[k]), `NaN at step ${i}`);
    }
  }
});

test("density stays close to 1 everywhere (mass is conserved)", () => {
  const s = run(fluid.init(1, P), 1500);
  let min = Infinity, max = -Infinity;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (fluidIsObstacle(x, y)) continue;
      const { rho } = velocity(s, x, y);
      if (rho < min) min = rho;
      if (rho > max) max = rho;
    }
  }
  assert.ok(min > 0.8 && max < 1.2, `density drifted to [${min.toFixed(2)}, ${max.toFixed(2)}]`);
});

test("a wake forms: flow recirculates (backflow) right behind the cylinder", () => {
  const s = run(fluid.init(1, P), 1500);
  const behind = velocity(s, 80, 43);
  assert.ok(behind.ux < 0.04, `expected slow/recirculating wake, ux=${behind.ux.toFixed(3)}`);
  const free = velocity(s, 20, 48);
  assert.ok(free.ux > 0.07, `free stream should flow near inflow speed, ux=${free.ux.toFixed(3)}`);
});

test("the cylinder is an obstacle and the flow goes around it", () => {
  assert.ok(fluidIsObstacle(64, 43));
  assert.ok(!fluidIsObstacle(20, 48));
  const s = run(fluid.init(1, P), 800);
  // fluid squeezes past: above/below the cylinder it speeds up
  const beside = velocity(s, 64, 30);
  assert.ok(beside.ux > 0, "flow should pass beside the cylinder");
});

test("same seed replays the same flow", () => {
  const a = run(fluid.init(5, P), 200);
  const b = run(fluid.init(5, P), 200);
  assert.deepEqual([...a.f], [...b.f]);
});

test("step does not mutate the previous state", () => {
  const s = fluid.init(9, P);
  const before = [...s.f];
  fluid.step(s, P);
  assert.deepEqual([...s.f], before);
});
