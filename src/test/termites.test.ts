import { test } from "node:test";
import assert from "node:assert/strict";
import { termites, countPiles, TERMITES_WORLD, type TermitesState } from "../sims/termites.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(termites.params);

function run(state: TermitesState, steps: number, p: Params = P): TermitesState {
  let s = state;
  for (let i = 0; i < steps; i++) s = termites.step(s, p);
  return s;
}

function totalChips(s: TermitesState): number {
  let onGround = 0;
  for (const v of s.chips.cells) onGround += v;
  let carried = 0;
  for (const t of s.termites) if (t.carrying) carried++;
  return onGround + carried;
}

test("chips are conserved (ground + carried) across the whole run", () => {
  let s = termites.init(42, P);
  const total = totalChips(s);
  for (let i = 0; i < 400; i++) {
    s = termites.step(s, P);
    assert.equal(totalChips(s), total, `chips leaked at tick ${s.tick}`);
  }
});

test("termites stay on the torus", () => {
  const s = run(termites.init(7, P), 200);
  for (const t of s.termites) {
    assert.ok(t.x >= 0 && t.x < TERMITES_WORLD.w);
    assert.ok(t.y >= 0 && t.y < TERMITES_WORLD.h);
  }
});

test("countPiles flood-fills connected clusters and ignores singletons", () => {
  const cells = new Uint8Array(TERMITES_WORLD.w * TERMITES_WORLD.h);
  const W = TERMITES_WORLD.w;
  // a 3-cell heap...
  cells[10 * W + 10] = 1;
  cells[10 * W + 11] = 1;
  cells[11 * W + 10] = 1;
  // ...and a lone chip far away (should not count as a pile)
  cells[50 * W + 50] = 1;
  const { piles, biggest } = countPiles(cells);
  assert.equal(piles, 1);
  assert.equal(biggest, 3);
});

test("sorting happens: chips coalesce into bigger piles over time", () => {
  let s = termites.init(1, P);
  const startBiggest = termites.stats(s, P).biggestPile;
  s = run(s, 3000);
  const endBiggest = termites.stats(s, P).biggestPile;
  assert.ok(endBiggest > startBiggest * 2, `piles should grow: ${startBiggest} -> ${endBiggest}`);
});

test("same seed replays the same colony", () => {
  const a = run(termites.init(5, P), 200);
  const b = run(termites.init(5, P), 200);
  assert.deepEqual([...a.chips.cells], [...b.chips.cells]);
  assert.deepEqual(a.termites, b.termites);
});

test("step does not mutate the previous state", () => {
  const s = termites.init(9, P);
  const chips = [...s.chips.cells];
  const ts = s.termites.map((t) => ({ ...t }));
  termites.step(s, P);
  assert.deepEqual([...s.chips.cells], chips);
  assert.deepEqual(s.termites, ts);
});
