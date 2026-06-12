import { test } from "node:test";
import assert from "node:assert/strict";
import { percolation, P_CRITICAL, type PercolationState } from "../sims/percolation.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(percolation.params);

function at(porosity: number, seed = 1): PercolationState {
  const p: Params = { ...P, porosity };
  return percolation.step(percolation.init(seed, p), p);
}

test("zero porosity: solid rock, nothing wet", () => {
  const s = at(0);
  assert.ok(s.wet.cells.every((v) => v === 0));
  assert.equal(s.percolates, false);
});

test("full porosity: everything wet, water breaks through", () => {
  const s = at(1);
  assert.ok(s.wet.cells.every((v) => v === 2));
  assert.equal(s.percolates, true);
});

test("well below the critical point, water never spans", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    assert.equal(at(0.45, seed).percolates, false, `seed ${seed} should not percolate at p=0.45`);
  }
});

test("well above the critical point, water always spans", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    assert.equal(at(0.7, seed).percolates, true, `seed ${seed} should percolate at p=0.7`);
  }
});

test("monotonicity: raising porosity never dries a wet site", () => {
  const low = at(0.5);
  const high = at(0.62);
  for (let i = 0; i < low.wet.cells.length; i++) {
    if (low.wet.cells[i] === 2) {
      assert.equal(high.wet.cells[i], 2, `site ${i} dried out as porosity rose`);
    }
  }
});

test("wet sites are exactly the open sites connected to the top", () => {
  const s = at(0.55);
  const { w, h, cells } = s.wet;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = cells[y * w + x];
      if (v !== 2) continue;
      if (y === 0) continue;
      const neighbors = [
        x > 0 ? cells[y * w + x - 1] : 0,
        x < w - 1 ? cells[y * w + x + 1] : 0,
        cells[(y - 1) * w + x],
        y < h - 1 ? cells[(y + 1) * w + x] : 0,
      ];
      assert.ok(neighbors.includes(2), `wet site (${x},${y}) has no wet neighbor`);
    }
  }
});

test("critical constant matches the literature value", () => {
  assert.ok(Math.abs(P_CRITICAL - 0.5927) < 1e-4);
});

test("same seed gives the same rock", () => {
  const a = at(0.55, 7);
  const b = at(0.55, 7);
  assert.deepEqual([...a.wet.cells], [...b.wet.cells]);
});

test("step does not mutate the previous state", () => {
  const p: Params = { ...P, porosity: 0.55 };
  const s = percolation.init(1, p);
  const before = [...s.wet.cells];
  percolation.step(s, p);
  assert.deepEqual([...s.wet.cells], before);
});
