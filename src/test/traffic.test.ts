import { test } from "node:test";
import assert from "node:assert/strict";
import { traffic, ROAD_LENGTH, type TrafficState } from "../sims/traffic.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(traffic.params);

function run(state: TrafficState, steps: number, p = P): TrafficState {
  let s = state;
  for (let i = 0; i < steps; i++) s = traffic.step(s, p);
  return s;
}

test("car count is conserved", () => {
  const start = traffic.init(42, P);
  const end = run(start, 200);
  assert.equal(end.pos.length, start.pos.length);
});

test("no two cars ever occupy the same cell", () => {
  let s = traffic.init(7, P);
  for (let i = 0; i < 150; i++) {
    s = traffic.step(s, P);
    assert.equal(new Set(s.pos).size, s.pos.length, `collision at tick ${s.tick}`);
  }
});

test("cars never pass each other (ring order preserved)", () => {
  let s = traffic.init(13, P);
  for (let i = 0; i < 100; i++) {
    const before = s;
    s = traffic.step(s, P);
    for (let c = 0; c < s.pos.length; c++) {
      const moved = (s.pos[c] - before.pos[c] + ROAD_LENGTH) % ROAD_LENGTH;
      assert.ok(moved <= P.vmax, `car ${c} teleported ${moved}`);
    }
  }
});

test("speeds stay within [0, vmax]", () => {
  let s = traffic.init(9, P);
  for (let i = 0; i < 100; i++) {
    s = traffic.step(s, P);
    for (const v of s.vel) assert.ok(v >= 0 && v <= P.vmax);
  }
});

test("free flow: no dawdling and low density reaches the speed limit", () => {
  const free = { ...P, density: 0.05, pSlow: 0 };
  const s = run(traffic.init(3, free), 50, free);
  for (const v of s.vel) assert.equal(v, P.vmax);
});

test("dawdling at moderate density produces stopped cars (phantom jams)", () => {
  const jammy = { ...P, density: 0.35, pSlow: 0.5 };
  let s = traffic.init(5, jammy);
  let sawJam = false;
  for (let i = 0; i < 100 && !sawJam; i++) {
    s = traffic.step(s, jammy);
    sawJam = traffic.stats(s, jammy).stopped > 0;
  }
  assert.ok(sawJam, "expected at least one stopped car within 100 steps");
});

test("same seed replays the same road", () => {
  const a = run(traffic.init(8, P), 80);
  const b = run(traffic.init(8, P), 80);
  assert.deepEqual([...a.pos], [...b.pos]);
  assert.deepEqual([...a.vel], [...b.vel]);
});

test("step does not mutate the previous state", () => {
  const s = traffic.init(11, P);
  const pos = [...s.pos];
  const vel = [...s.vel];
  traffic.step(s, P);
  assert.deepEqual([...s.pos], pos);
  assert.deepEqual([...s.vel], vel);
});

test("history is capped", () => {
  const s = run(traffic.init(2, P), 400);
  assert.ok(s.history.length <= 320);
});
