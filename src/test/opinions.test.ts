import { test } from "node:test";
import assert from "node:assert/strict";
import { opinions, clusterCount, type OpinionsState } from "../sims/opinions.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(opinions.params);

function run(state: OpinionsState, steps: number, p: Params = P): OpinionsState {
  let s = state;
  for (let i = 0; i < steps; i++) s = opinions.step(s, p);
  return s;
}

function mean(xs: ReadonlyArray<number>): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

test("clusterCount on known distributions", () => {
  assert.equal(clusterCount([0.5, 0.5, 0.5], 0.2), 1);
  assert.equal(clusterCount([0.1, 0.11, 0.9, 0.91], 0.2), 2);
  assert.equal(clusterCount([], 0.2), 0);
});

test("opinions always stay in [0, 1]", () => {
  let s = opinions.init(42, P);
  for (let i = 0; i < 200; i++) {
    s = opinions.step(s, P);
    for (const x of s.opinions) assert.ok(x >= 0 && x <= 1);
  }
});

test("compromise conserves the average opinion exactly (no zealots)", () => {
  let s = opinions.init(7, P);
  const before = mean(s.opinions);
  s = run(s, 300);
  assert.ok(Math.abs(mean(s.opinions) - before) < 1e-9);
});

test("wide confidence reaches consensus", () => {
  const p: Params = { ...P, epsilon: 0.5 };
  const s = run(opinions.init(1, p), 400, p);
  const st = opinions.stats(s, p);
  assert.equal(st.clusters, 1, "should converge to one camp");
  assert.ok(st.spread < 0.05, `spread should collapse, got ${st.spread}`);
});

test("narrow confidence freezes several camps", () => {
  const p: Params = { ...P, epsilon: 0.06 };
  const s = run(opinions.init(1, p), 600, p);
  assert.ok(opinions.stats(s, p).clusters >= 3, "narrow minds should fragment");
});

test("zealots drag the average toward their corner", () => {
  const p: Params = { ...P, zealots: 0.1, epsilon: 0.3 };
  let s = opinions.init(3, p);
  const before = mean(s.opinions);
  s = run(s, 600, p);
  const after = mean(s.opinions);
  assert.ok(after > before + 0.05, `zealots at 0.95 should pull mean up: ${before} -> ${after}`);
});

test("zealots never move", () => {
  const p: Params = { ...P, zealots: 0.05 };
  let s = opinions.init(5, p);
  const fixed = s.opinions.slice(0, s.zealotCount);
  s = run(s, 100, p);
  assert.deepEqual(s.opinions.slice(0, s.zealotCount), fixed);
});

test("same seed replays the same society", () => {
  const a = run(opinions.init(9, P), 150);
  const b = run(opinions.init(9, P), 150);
  assert.deepEqual(a.opinions, b.opinions);
});

test("step does not mutate the previous state", () => {
  const s = opinions.init(11, P);
  const before = [...s.opinions];
  opinions.step(s, P);
  assert.deepEqual([...s.opinions], before);
});
