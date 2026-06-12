import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

const N = 48; // genome side
const CELLS = N * N;

export interface EvolveState {
  /** Population of genomes, each a length-CELLS Uint8Array of 0/1. */
  readonly population: ReadonlyArray<Uint8Array>;
  readonly bestIdx: number;
  readonly bestFitness: number;
  readonly target: Uint8Array;
  readonly rngState: number;
  readonly generation: number;
}

const HIT = rgb(122, 215, 255);
const MISS_ON = rgb(60, 80, 110); // genome says on, target says off
const MISS_OFF = rgb(40, 30, 30); // genome says off, target says on
const OFF = rgb(12, 14, 20);

function makeTarget(kind: number): Uint8Array {
  const t = new Uint8Array(CELLS);
  const c = (N - 1) / 2;
  const set = (f: (x: number, y: number) => boolean) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (f(x, y)) t[y * N + x] = 1;
  };
  if (kind === 0) {
    // heart
    set((x, y) => {
      const nx = (x - c) / (N * 0.42);
      const ny = (c - y) / (N * 0.42) + 0.2;
      const v = nx * nx + (ny - Math.sqrt(Math.abs(nx))) ** 2;
      return v < 0.7;
    });
  } else if (kind === 1) {
    // smiley
    set((x, y) => {
      const r = Math.hypot(x - c, y - c);
      if (r > N * 0.42) return false;
      const eye = (Math.hypot(x - (c - 8), y - (c - 5)) < 3) || (Math.hypot(x - (c + 8), y - (c - 5)) < 3);
      const mouth = y > c + 4 && y < c + 9 && Math.abs(x - c) < 10 && Math.hypot(x - c, (y - (c + 2)) * 1.4) > 9;
      return r > N * 0.36 || (!eye && !mouth);
    });
  } else {
    // letter A
    set((x, y) => {
      const t1 = Math.abs((x - c) / (y - 4 + 0.001)) < 0.55 && y > 6 && y < N - 6;
      const bar = Math.abs(y - (c + 6)) < 2 && Math.abs(x - c) < (y - 4) * 0.55;
      const legs = t1 && Math.abs(Math.abs(x - c) - (y - 4) * 0.5) < 2.4;
      return legs || bar;
    });
  }
  return t;
}

function fitness(genome: Uint8Array, target: Uint8Array): number {
  let match = 0;
  for (let i = 0; i < CELLS; i++) if (genome[i] === target[i]) match++;
  return match / CELLS;
}

export const evolveImage: Simulation<EvolveState> = {
  id: "evolve",
  name: "Evolving Pictures",
  blurb: "Cumulative selection builds the improbable",
  description:
    "A population of random pixel-grids breeds toward a target picture. Each generation: " +
    "score every grid by how well it matches, let the fitter ones have more offspring, " +
    "mix two parents per child, and flip a few pixels at random. No grid is ever " +
    "designed — yet the target assembles itself out of noise in a few hundred " +
    "generations. Random mutation is the monkey at the typewriter; selection is what " +
    "keeps the good keystrokes. That ratchet is how blind evolution builds eyes.",
  whatToTry:
    "Set mutation near zero and the population converges fast but can get stuck short " +
    "of perfect; too high and selection can't hold what it gains — there is a sweet " +
    "spot, the same one real genomes tune. Watch the best-match curve climb in a " +
    "staircase: each step is a lucky mutation that stuck.",
  params: [
    { key: "target", label: "Target", min: 0, max: 2, step: 1, default: 0, options: ["heart", "smiley", "letter A"], reinit: true },
    { key: "popSize", label: "Population", min: 30, max: 400, step: 10, default: 150, reinit: true },
    { key: "mutation", label: "Mutation rate", min: 0.0005, max: 0.02, step: 0.0005, default: 0.002 },
    { key: "tournament", label: "Selection pressure", min: 2, max: 12, step: 1, default: 7 },
  ],
  series: [
    { key: "best", label: "Best match", color: "#7ad7ff" },
    { key: "mean", label: "Mean match", color: "#9ece6a" },
  ],
  maxStepsPerFrame: 4,

  init(seed: number, p: Params): EvolveState {
    const rng = new Rng(seed);
    const target = makeTarget(Math.round(p.target));
    const population: Uint8Array[] = [];
    for (let k = 0; k < p.popSize; k++) {
      const g = new Uint8Array(CELLS);
      for (let i = 0; i < CELLS; i++) g[i] = rng.bool(0.5) ? 1 : 0;
      population.push(g);
    }
    const { idx, fit } = best(population, target);
    return { population, bestIdx: idx, bestFitness: fit, target, rngState: rng.state(), generation: 0 };
  },

  step(s: EvolveState, p: Params): EvolveState {
    const rng = Rng.fromState(s.rngState);
    const pop = s.population;
    const n = pop.length;
    const fits = pop.map((g) => fitness(g, s.target));

    const pickParent = (): Uint8Array => {
      let bestI = rng.int(n);
      for (let t = 1; t < p.tournament; t++) {
        const c = rng.int(n);
        if (fits[c] > fits[bestI]) bestI = c;
      }
      return pop[bestI];
    };

    // elitism: carry the current best unchanged
    let eliteIdx = 0;
    for (let i = 1; i < n; i++) if (fits[i] > fits[eliteIdx]) eliteIdx = i;
    const next: Uint8Array[] = [pop[eliteIdx].slice()];

    while (next.length < n) {
      const a = pickParent();
      const b = pickParent();
      const child = new Uint8Array(CELLS);
      for (let i = 0; i < CELLS; i++) {
        child[i] = (rng.bool(0.5) ? a[i] : b[i]) ^ (rng.bool(p.mutation) ? 1 : 0);
      }
      next.push(child);
    }

    const { idx, fit } = best(next, s.target);
    return {
      population: next,
      bestIdx: idx,
      bestFitness: fit,
      target: s.target,
      rngState: rng.state(),
      generation: s.generation + 1,
    };
  },

  render(s, ctx, view) {
    const g = s.population[s.bestIdx];
    const target = s.target;
    paintGrid(ctx, view, { w: N, h: N, cells: new Int16Array(CELLS) }, "evolve", (_v, i) => {
      const on = g[i] === 1;
      const want = target[i] === 1;
      if (on && want) return HIT;
      if (on && !want) return MISS_ON;
      if (!on && want) return MISS_OFF;
      return OFF;
    });
  },

  stats(s) {
    let sum = 0;
    for (const g of s.population) sum += fitness(g, s.target);
    return {
      generation: s.generation,
      best: s.bestFitness,
      mean: sum / s.population.length,
    };
  },
};

function best(pop: ReadonlyArray<Uint8Array>, target: Uint8Array): { idx: number; fit: number } {
  let idx = 0;
  let fit = -1;
  for (let i = 0; i < pop.length; i++) {
    const f = fitness(pop[i], target);
    if (f > fit) {
      fit = f;
      idx = i;
    }
  }
  return { idx, fit };
}

export const EVOLVE_N = N;
export { makeTarget as evolveTarget, fitness as evolveFitness };
