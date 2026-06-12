import { Rng } from "../core/rng.js";
import { wrap } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { clear } from "../ui/painter.js";

export const SUSCEPTIBLE = 0;
export const INFECTED = 1;
export const RECOVERED = 2;

export interface Person {
  readonly x: number;
  readonly y: number;
  readonly state: number;
  /** Steps of infection remaining; 0 unless infected. */
  readonly timer: number;
}

export interface EpidemicState {
  readonly people: ReadonlyArray<Person>;
  readonly rngState: number;
  readonly tick: number;
}

export const EPI_WORLD = { w: 120, h: 80 };
const W = EPI_WORLD.w;
const H = EPI_WORLD.h;

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

const COLORS = ["#5c6a82", "#ff5a50", "#9ece6a"];

export const epidemic: Simulation<EpidemicState> = {
  id: "epidemic",
  name: "Epidemic",
  blurb: "SIR waves from random walks",
  description:
    "People wander; the infected pass it to neighbors with some probability, then " +
    "recover immune. From those micro-encounters the macro curve assembles itself: " +
    "the S-shaped burn through the susceptible, the infection peak, herd immunity. " +
    "Nobody in the model knows what an epidemic is.",
  whatToTry:
    "Find the threshold: lower infectiousness until outbreaks sputter out instead of " +
    "taking off — that knife edge is R₀ = 1. Then halve mobility instead; distancing " +
    "moves the same dial.",
  params: [
    { key: "people", label: "People", min: 100, max: 2000, step: 50, default: 700, reinit: true },
    { key: "infected0", label: "Patient zeros", min: 1, max: 50, step: 1, default: 5, reinit: true },
    { key: "beta", label: "Infectiousness", min: 0, max: 1, step: 0.01, default: 0.22 },
    { key: "recovery", label: "Sick for (steps)", min: 10, max: 200, step: 5, default: 60 },
    { key: "mobility", label: "Mobility", min: 0, max: 1, step: 0.05, default: 0.8 },
  ],
  series: [
    { key: "susceptible", label: "Susceptible", color: "#5c6a82" },
    { key: "infected", label: "Infected", color: "#ff5a50" },
    { key: "recovered", label: "Recovered", color: "#9ece6a" },
  ],
  maxStepsPerFrame: 8,

  init(seed: number, p: Params): EpidemicState {
    const rng = new Rng(seed);
    const people: Person[] = Array.from({ length: p.people }, (_, i) => ({
      x: rng.int(W),
      y: rng.int(H),
      state: i < p.infected0 ? INFECTED : SUSCEPTIBLE,
      timer: i < p.infected0 ? p.recovery : 0,
    }));
    return { people, rngState: rng.state(), tick: 0 };
  },

  step(s: EpidemicState, p: Params): EpidemicState {
    const rng = Rng.fromState(s.rngState);

    const moved = s.people.map((person) => {
      if (!rng.bool(p.mobility)) return person;
      const [dx, dy] = DIRS[rng.int(9)];
      return { ...person, x: wrap(person.x + dx, W), y: wrap(person.y + dy, H) };
    });

    const infectedNear = new Map<number, number>();
    for (const person of moved) {
      if (person.state !== INFECTED) continue;
      for (const [dx, dy] of DIRS) {
        const cell = wrap(person.y + dy, H) * W + wrap(person.x + dx, W);
        infectedNear.set(cell, (infectedNear.get(cell) ?? 0) + 1);
      }
    }

    const people = moved.map((person) => {
      if (person.state === INFECTED) {
        const timer = person.timer - 1;
        return timer <= 0
          ? { ...person, state: RECOVERED, timer: 0 }
          : { ...person, timer };
      }
      if (person.state === SUSCEPTIBLE) {
        const k = infectedNear.get(person.y * W + person.x) ?? 0;
        if (k > 0 && rng.bool(1 - (1 - p.beta) ** k)) {
          return { ...person, state: INFECTED, timer: p.recovery };
        }
      }
      return person;
    });

    return { people, rngState: rng.state(), tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    clear(ctx, view, "#0a0c10");
    const kx = view.width / W;
    const ky = view.height / H;
    for (const person of s.people) {
      ctx.fillStyle = COLORS[person.state];
      ctx.fillRect(person.x * kx + 1, person.y * ky + 1, kx - 2, ky - 2);
    }
  },

  stats(s) {
    let susceptible = 0;
    let infected = 0;
    let recovered = 0;
    for (const person of s.people) {
      if (person.state === SUSCEPTIBLE) susceptible++;
      else if (person.state === INFECTED) infected++;
      else recovered++;
    }
    return { tick: s.tick, susceptible, infected, recovered };
  },
};
