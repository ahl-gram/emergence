import { test } from "node:test";
import assert from "node:assert/strict";
import { evolveImage, evolveFitness, evolveTarget, EVOLVE_N, type EvolveState } from "../sims/evolveimage.js";
import { defaultParams, type Params } from "../core/types.js";

const P = defaultParams(evolveImage.params);
const CELLS = EVOLVE_N * EVOLVE_N;

function run(state: EvolveState, steps: number, p: Params = P): EvolveState {
  let s = state;
  for (let i = 0; i < steps; i++) s = evolveImage.step(s, p);
  return s;
}

test("population size and genome size are correct", () => {
  const s = evolveImage.init(1, P);
  assert.equal(s.population.length, P.popSize);
  for (const g of s.population) assert.equal(g.length, CELLS);
});

test("a random start scores near 50% match", () => {
  const s = evolveImage.init(1, P);
  assert.ok(s.bestFitness > 0.45 && s.bestFitness < 0.65, `random best=${s.bestFitness}`);
});

test("best fitness never decreases (elitism)", () => {
  let s = evolveImage.init(1, P);
  let prev = s.bestFitness;
  for (let i = 0; i < 200; i++) {
    s = evolveImage.step(s, P);
    assert.ok(s.bestFitness >= prev - 1e-9, `best dropped ${prev} -> ${s.bestFitness}`);
    prev = s.bestFitness;
  }
});

test("cumulative selection reconstructs the target almost perfectly", () => {
  let s = evolveImage.init(1, P);
  s = run(s, 600);
  assert.ok(s.bestFitness > 0.97, `should evolve close to the target, got ${s.bestFitness}`);
});

test("reported bestFitness matches the reported best genome", () => {
  const s = run(evolveImage.init(2, P), 50);
  const actual = evolveFitness(s.population[s.bestIdx], s.target);
  assert.ok(Math.abs(actual - s.bestFitness) < 1e-9);
});

test("different target options produce different targets", () => {
  const heart = evolveTarget(0);
  const smiley = evolveTarget(1);
  const letter = evolveTarget(2);
  assert.notDeepEqual([...heart], [...smiley]);
  assert.notDeepEqual([...smiley], [...letter]);
  for (const t of [heart, smiley, letter]) {
    const on = t.reduce((a, b) => a + b, 0);
    assert.ok(on > 20 && on < CELLS, "target should be a non-trivial shape");
  }
});

test("same seed replays the same evolution", () => {
  const a = run(evolveImage.init(5, P), 80);
  const b = run(evolveImage.init(5, P), 80);
  assert.equal(a.bestFitness, b.bestFitness);
  assert.deepEqual([...a.population[a.bestIdx]], [...b.population[b.bestIdx]]);
});

test("step does not mutate the previous generation", () => {
  const s = evolveImage.init(7, P);
  const before = s.population.map((g) => [...g]);
  evolveImage.step(s, P);
  assert.deepEqual(s.population.map((g) => [...g]), before);
});
