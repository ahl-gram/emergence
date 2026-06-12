import { test } from "node:test";
import assert from "node:assert/strict";
import { snowflake, SNOWFLAKE_WORLD, hexNeighbors, type SnowflakeState } from "../sims/snowflake.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(snowflake.params);
const { w: W, h: H } = SNOWFLAKE_WORLD;

function run(state: SnowflakeState, steps: number, p: Params = P): SnowflakeState {
  let s = state;
  for (let i = 0; i < steps; i++) s = snowflake.step(s, p);
  return s;
}

test("hex neighborhood always has six distinct cells", () => {
  for (const [x, y] of [[10, 10], [11, 11], [10, 11], [11, 10]]) {
    const ns = hexNeighbors(x, y);
    assert.equal(ns.length, 6);
    const keys = new Set(ns.map(([a, b]) => `${a},${b}`));
    assert.equal(keys.size, 6);
    assert.ok(!keys.has(`${x},${y}`), "a cell is not its own neighbor");
  }
});

test("starts as a single frozen seed in a uniform vapor field", () => {
  const s = snowflake.init(1, P);
  assert.equal(s.frozen, 1);
  assert.equal(s.water.cells[(H >> 1) * W + (W >> 1)], 1);
});

test("the crystal only grows — ice never melts", () => {
  let s = snowflake.init(1, P);
  let prev = s.frozen;
  for (let i = 0; i < 120; i++) {
    s = snowflake.step(s, P);
    assert.ok(s.frozen >= prev, `ice count dropped at tick ${s.tick}`);
    prev = s.frozen;
  }
  assert.ok(s.frozen > 1, "the crystal should have grown");
});

test("the crystal keeps the six-fold symmetry of the seed", () => {
  const s = run(snowflake.init(1, P), 80);
  const cx = W >> 1;
  const cy = H >> 1;
  const ice = (x: number, y: number) => (s.water.cells[y * W + x] >= 1 ? 1 : 0);
  // horizontal mirror symmetry about the seed row
  let asymmetric = 0;
  for (let dy = 1; dy < 40; dy++) {
    for (let dx = -40; dx <= 40; dx++) {
      if (ice(cx + dx, cy + dy) !== ice(cx + dx, cy - dy)) asymmetric++;
    }
  }
  assert.equal(asymmetric, 0, "crystal should be mirror-symmetric across the seed row");
});

test("vapor parameter changes the crystal it grows", () => {
  const star = run(snowflake.init(1, { ...P, beta: 0.4 }), 150, { ...P, beta: 0.4 });
  const plate = run(snowflake.init(1, { ...P, beta: 0.85 }), 150, { ...P, beta: 0.85 });
  assert.notEqual(star.frozen, plate.frozen);
});

test("same seed and params grow the same flake", () => {
  const a = run(snowflake.init(1, P), 100);
  const b = run(snowflake.init(1, P), 100);
  assert.deepEqual([...a.water.cells], [...b.water.cells]);
});

test("step does not mutate the previous state", () => {
  const s = snowflake.init(1, P);
  const before = [...s.water.cells];
  snowflake.step(s, P);
  assert.deepEqual([...s.water.cells], before);
});
