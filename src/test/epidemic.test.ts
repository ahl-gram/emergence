import { test } from "node:test";
import assert from "node:assert/strict";
import {
  epidemic,
  SUSCEPTIBLE,
  INFECTED,
  RECOVERED,
  EPI_WORLD,
  type EpidemicState,
} from "../sims/epidemic.js";
import { defaultParams } from "../core/types.js";

const P = defaultParams(epidemic.params);

function run(state: EpidemicState, steps: number, p = P): EpidemicState {
  let s = state;
  for (let i = 0; i < steps; i++) s = epidemic.step(s, p);
  return s;
}

test("population is conserved across compartments", () => {
  let s = epidemic.init(42, P);
  for (let i = 0; i < 100; i++) {
    s = epidemic.step(s, P);
    const st = epidemic.stats(s, P);
    assert.equal(st.susceptible + st.infected + st.recovered, P.people);
  }
});

test("with zero infectiousness the outbreak dies without spreading", () => {
  const p = { ...P, beta: 0 };
  let s = epidemic.init(7, p);
  s = run(s, P.recovery + 5, p);
  const st = epidemic.stats(s, p);
  assert.equal(st.infected, 0, "patient zeros should have recovered");
  assert.equal(st.recovered, P.infected0, "nobody else should catch it");
  assert.equal(st.susceptible, P.people - P.infected0);
});

test("a contagious disease spreads beyond patient zero", () => {
  let s = epidemic.init(1, P);
  s = run(s, 400);
  const st = epidemic.stats(s, P);
  assert.ok(
    st.recovered + st.infected > P.infected0 * 3,
    `expected real spread, got R+I=${st.recovered + st.infected}`,
  );
});

test("recovered people never become infected again", () => {
  let s = epidemic.init(3, P);
  let everRecovered = new Set<number>();
  for (let i = 0; i < 300; i++) {
    s = epidemic.step(s, P);
    s.people.forEach((person, idx) => {
      if (person.state === RECOVERED) everRecovered.add(idx);
      if (everRecovered.has(idx)) {
        assert.equal(person.state, RECOVERED, `person ${idx} was reinfected at tick ${s.tick}`);
      }
    });
  }
});

test("people stay on the map", () => {
  let s = epidemic.init(9, P);
  s = run(s, 100);
  for (const person of s.people) {
    assert.ok(person.x >= 0 && person.x < EPI_WORLD.w);
    assert.ok(person.y >= 0 && person.y < EPI_WORLD.h);
  }
});

test("same seed replays the same outbreak", () => {
  const a = run(epidemic.init(5, P), 150);
  const b = run(epidemic.init(5, P), 150);
  assert.deepEqual(a.people, b.people);
});

test("step does not mutate the previous state", () => {
  const s = epidemic.init(11, P);
  const before = s.people.map((person) => ({ ...person }));
  epidemic.step(s, P);
  assert.deepEqual(s.people, before);
});
