import { Rng } from "../core/rng.js";
import { makeGrid, wrap, MOORE, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface RpsState {
  /** 0 = empty, otherwise species 1..species. */
  readonly grid: Grid<Uint8Array>;
  readonly rngState: number;
  readonly tick: number;
}

const W = 200;
const H = 140;
const EMPTY = 0;

const SPECIES_COLORS = [
  rgb(12, 14, 19),
  rgb(122, 215, 255),
  rgb(255, 120, 90),
  rgb(150, 230, 120),
  rgb(220, 160, 255),
  rgb(255, 210, 90),
];

/** In a cycle of k species, x beats y iff (x - y) mod k is in 1..floor(k/2). */
function beats(a: number, b: number, k: number): boolean {
  if (a === EMPTY || b === EMPTY) return false;
  const diff = ((a - b) % k + k) % k;
  return diff >= 1 && diff <= Math.floor(k / 2);
}

export const rps: Simulation<RpsState> = {
  id: "rps",
  name: "Cyclic Dominance",
  blurb: "Rock-paper-scissors makes spirals",
  description:
    "Several species in a loop, each preying on the next: rock crushes scissors, " +
    "scissors cut paper, paper covers rock. A predator that touches its prey converts " +
    "it. No species can win — chase its prey and you expose your back to your own " +
    "predator — so the populations lock into endlessly rotating spiral territories. " +
    "Lizard mating strategies, coral reefs, and bacterial colonies all do this.",
  whatToTry:
    "Three species give the classic interlocking pinwheels. Bump to five and the " +
    "spirals fragment into a finer, more turbulent weave. Raise the invasion " +
    "threshold for bold, slow-rotating arms; lower it and the texture gets jittery. " +
    "The order is dynamic — it never settles, but it never collapses either.",
  params: [
    { key: "species", label: "Species", min: 3, max: 5, step: 1, default: 3, reinit: true },
    { key: "threshold", label: "Invasion threshold", min: 1, max: 4, step: 1, default: 3 },
  ],
  series: [{ key: "fronts", label: "Battle-front cells", color: "#ff785a" }],
  maxStepsPerFrame: 12,

  init(seed: number, p: Params): RpsState {
    const rng = new Rng(seed);
    const grid = makeGrid(W, H);
    for (let i = 0; i < grid.cells.length; i++) {
      grid.cells[i] = 1 + rng.int(p.species);
    }
    return { grid, rngState: rng.state(), tick: 0 };
  },

  step(s: RpsState, p: Params): RpsState {
    const k = p.species;
    const predatorOf = (sp: number) => (sp % k) + 1; // species that beats sp
    const cells = s.grid.cells;
    const next = cells.slice();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const me = cells[i];
        const predator = predatorOf(me);
        let count = 0;
        for (const [dx, dy] of MOORE) {
          if (cells[wrap(y + dy, H) * W + wrap(x + dx, W)] === predator) count++;
        }
        if (count >= p.threshold) next[i] = predator;
      }
    }
    return { grid: { w: W, h: H, cells: next }, rngState: s.rngState, tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.grid, "rps", (v) => SPECIES_COLORS[v] ?? SPECIES_COLORS[0]);
  },

  stats(s, p) {
    const k = p.species;
    const cells = s.grid.cells;
    const counts = new Array(k + 1).fill(0);
    let fronts = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const me = cells[y * W + x];
        counts[me]++;
        const right = cells[y * W + wrap(x + 1, W)];
        const down = cells[wrap(y + 1, H) * W + x];
        if (beats(me, right, k) || beats(right, me, k)) fronts++;
        if (beats(me, down, k) || beats(down, me, k)) fronts++;
      }
    }
    let dominant = 0;
    for (let sp = 1; sp <= k; sp++) dominant = Math.max(dominant, counts[sp]);
    return {
      tick: s.tick,
      fronts,
      topSpeciesShare: dominant / cells.length,
    };
  },

  onPointer(s, x, y, buttons, p) {
    const cx = Math.floor(x * W);
    const cy = Math.floor(y * H);
    const species = buttons & 2 ? 1 + (s.tick % p.species) : 1;
    const next = s.grid.cells.slice();
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 9) continue;
        next[wrap(cy + dy, H) * W + wrap(cx + dx, W)] = species;
      }
    }
    return { ...s, grid: { w: W, h: H, cells: next } };
  },
};

export const RPS_WORLD = { w: W, h: H };
export { beats as rpsBeats };
