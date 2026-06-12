import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeGrid,
  makeGridOf,
  cloneGrid,
  idx,
  wrap,
  countWrap,
  MOORE,
  VON_NEUMANN,
} from "../core/grid.js";

test("makeGrid creates a zeroed Uint8 grid of the right size", () => {
  const g = makeGrid(10, 6);
  assert.equal(g.w, 10);
  assert.equal(g.h, 6);
  assert.equal(g.cells.length, 60);
  assert.ok(g.cells.every((c) => c === 0));
});

test("makeGridOf supports other typed arrays", () => {
  const g = makeGridOf(4, 4, Float32Array);
  assert.ok(g.cells instanceof Float32Array);
  assert.equal(g.cells.length, 16);
});

test("idx maps (x, y) to row-major offset", () => {
  const g = makeGrid(10, 6);
  assert.equal(idx(g, 0, 0), 0);
  assert.equal(idx(g, 9, 0), 9);
  assert.equal(idx(g, 0, 1), 10);
  assert.equal(idx(g, 3, 2), 23);
});

test("wrap handles negative and overflowing coordinates", () => {
  assert.equal(wrap(-1, 10), 9);
  assert.equal(wrap(10, 10), 0);
  assert.equal(wrap(25, 10), 5);
  assert.equal(wrap(-11, 10), 9);
  assert.equal(wrap(3, 10), 3);
});

test("cloneGrid returns an independent copy", () => {
  const g = makeGrid(3, 3);
  g.cells[4] = 7;
  const c = cloneGrid(g);
  assert.deepEqual([...c.cells], [...g.cells]);
  c.cells[4] = 9;
  assert.equal(g.cells[4], 7, "original must be unaffected");
});

test("neighborhood offsets have the right shape", () => {
  assert.equal(MOORE.length, 8);
  assert.equal(VON_NEUMANN.length, 4);
  for (const [dx, dy] of MOORE) {
    assert.ok(Math.abs(dx) <= 1 && Math.abs(dy) <= 1);
    assert.ok(dx !== 0 || dy !== 0);
  }
});

test("countWrap counts matching Moore neighbors on a torus", () => {
  const g = makeGrid(5, 5);
  // ring of 1s around center (2,2)
  for (const [dx, dy] of MOORE) g.cells[idx(g, 2 + dx, 2 + dy)] = 1;
  assert.equal(countWrap(g, 2, 2, 1, MOORE), 8);
  assert.equal(countWrap(g, 2, 2, 0, MOORE), 0);
});

test("countWrap wraps across edges", () => {
  const g = makeGrid(5, 5);
  g.cells[idx(g, 4, 0)] = 1; // wraps to be a Moore neighbor of (0,0)
  g.cells[idx(g, 0, 4)] = 1; // same
  assert.equal(countWrap(g, 0, 0, 1, MOORE), 2);
});

test("countWrap with von Neumann neighborhood", () => {
  const g = makeGrid(5, 5);
  g.cells[idx(g, 2, 1)] = 1;
  g.cells[idx(g, 1, 2)] = 1;
  g.cells[idx(g, 1, 1)] = 1; // diagonal — should NOT count
  assert.equal(countWrap(g, 2, 2, 1, VON_NEUMANN), 2);
});
