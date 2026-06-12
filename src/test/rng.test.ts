import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../core/rng.js";

test("same seed produces identical sequences", () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 1000; i++) {
    assert.equal(a.next(), b.next());
  }
});

test("different seeds produce different sequences", () => {
  const a = new Rng(1);
  const b = new Rng(2);
  const drawsA = Array.from({ length: 10 }, () => a.next());
  const drawsB = Array.from({ length: 10 }, () => b.next());
  assert.notDeepEqual(drawsA, drawsB);
});

test("next() stays in [0, 1)", () => {
  const rng = new Rng(7);
  for (let i = 0; i < 10000; i++) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test("int(n) stays in [0, n)", () => {
  const rng = new Rng(99);
  for (let i = 0; i < 10000; i++) {
    const v = rng.int(6);
    assert.ok(Number.isInteger(v));
    assert.ok(v >= 0 && v < 6, `out of range: ${v}`);
  }
});

test("int eventually hits every value in range", () => {
  const rng = new Rng(3);
  const seen = new Set<number>();
  for (let i = 0; i < 1000; i++) seen.add(rng.int(4));
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
});

test("range(a, b) stays within bounds", () => {
  const rng = new Rng(5);
  for (let i = 0; i < 1000; i++) {
    const v = rng.range(-2.5, 7.5);
    assert.ok(v >= -2.5 && v < 7.5);
  }
});

test("bool(0) is always false, bool(1) is always true", () => {
  const rng = new Rng(11);
  for (let i = 0; i < 100; i++) {
    assert.equal(rng.bool(0), false);
    assert.equal(rng.bool(1), true);
  }
});

test("bool(p) approximates p over many draws", () => {
  const rng = new Rng(13);
  let hits = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) if (rng.bool(0.3)) hits++;
  const rate = hits / n;
  assert.ok(Math.abs(rate - 0.3) < 0.02, `rate ${rate} too far from 0.3`);
});

test("pick returns elements from the array", () => {
  const rng = new Rng(17);
  const arr = ["a", "b", "c"];
  for (let i = 0; i < 100; i++) {
    assert.ok(arr.includes(rng.pick(arr)));
  }
});

test("shuffled returns a permutation without mutating input", () => {
  const rng = new Rng(19);
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const frozen = [...input];
  const out = rng.shuffled(input);
  assert.deepEqual(input, frozen, "input must not be mutated");
  assert.deepEqual([...out].sort((x, y) => x - y), frozen);
  assert.notDeepEqual(out, frozen, "8 elements with this seed should not stay in order");
});

test("state round-trips: resuming from saved state continues the sequence", () => {
  const a = new Rng(123);
  for (let i = 0; i < 50; i++) a.next();
  const saved = a.state();

  const b = Rng.fromState(saved);
  for (let i = 0; i < 50; i++) {
    assert.equal(a.next(), b.next());
  }
});
