import { test } from "node:test";
import assert from "node:assert/strict";
import { rps, rpsBeats, RPS_WORLD, type RpsState } from "../sims/rps.js";
import { makeGrid } from "../core/grid.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(rps.params);
const { w: W, h: H } = RPS_WORLD;

function run(state: RpsState, steps: number, p: Params = P): RpsState {
  let s = state;
  for (let i = 0; i < steps; i++) s = rps.step(s, p);
  return s;
}

test("the dominance relation is a proper 3-cycle", () => {
  assert.ok(rpsBeats(1, 3, 3)); // rock beats scissors
  assert.ok(rpsBeats(2, 1, 3)); // paper beats rock
  assert.ok(rpsBeats(3, 2, 3)); // scissors beats paper
  assert.ok(!rpsBeats(3, 1, 3));
  assert.ok(!rpsBeats(1, 1, 3)); // nothing beats itself
});

test("for any pair of distinct species exactly one beats the other (odd k)", () => {
  for (const k of [3, 5]) {
    for (let a = 1; a <= k; a++) {
      for (let b = 1; b <= k; b++) {
        if (a === b) {
          assert.ok(!rpsBeats(a, b, k));
        } else {
          assert.notEqual(rpsBeats(a, b, k), rpsBeats(b, a, k), `${a} vs ${b} mod ${k}`);
        }
      }
    }
  }
});

test("a monoculture is frozen — no predators to invade", () => {
  const grid = makeGrid(W, H);
  grid.cells.fill(2);
  const s: RpsState = { grid, rngState: 1, tick: 0 };
  const next = run(s, 20);
  assert.ok(next.grid.cells.every((v) => v === 2));
});

test("coexistence: no species ever takes over (it never settles)", () => {
  let s = rps.init(1, P);
  for (let i = 0; i < 400; i++) {
    s = rps.step(s, P);
    assert.ok(
      rps.stats(s, P).topSpeciesShare < 0.95,
      `cyclic dominance should prevent takeover at tick ${s.tick}`,
    );
  }
});

test("all cells always hold a valid species", () => {
  let s = rps.init(7, { ...P, species: 5 });
  s = run(s, 100, { ...P, species: 5 });
  for (const v of s.grid.cells) assert.ok(v >= 1 && v <= 5);
});

test("same seed replays the same battle", () => {
  const a = run(rps.init(3, P), 100);
  const b = run(rps.init(3, P), 100);
  assert.deepEqual([...a.grid.cells], [...b.grid.cells]);
});

test("step does not mutate the previous state", () => {
  const s = rps.init(5, P);
  const before = [...s.grid.cells];
  rps.step(s, P);
  assert.deepEqual([...s.grid.cells], before);
});
