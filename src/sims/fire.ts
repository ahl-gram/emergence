import { Rng } from "../core/rng.js";
import { makeGrid, countWrap, MOORE, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface FireState {
  readonly grid: Grid<Uint8Array>;
  readonly rngState: number;
  readonly tick: number;
}

export const EMPTY = 0;
export const TREE = 1;
export const BURNING = 2;

const W = 192;
const H = 128;
const C_EMPTY = rgb(10, 12, 16);
const C_TREE = rgb(53, 156, 86);
const C_BURN_A = rgb(255, 157, 61);
const C_BURN_B = rgb(255, 220, 120);

export const fire: Simulation<FireState> = {
  id: "fire",
  name: "Forest Fire",
  blurb: "Self-organized criticality",
  description:
    "Trees sprout at random, lightning occasionally strikes, and fire spreads to " +
    "adjacent trees. The forest tunes itself to the critical point where fires of " +
    "every size occur — mostly small ones, rarely continent-sized burns. Nobody " +
    "schedules the catastrophes; the system organizes itself toward them.",
  whatToTry:
    "Watch the burning count: long quiet stretches, then a spike. Raise growth and " +
    "the forest gets denser — and megafires more total. Eerily like real fire policy: " +
    "suppress every small fire and you store fuel for a huge one.",
  params: [
    { key: "density", label: "Initial trees", min: 0, max: 1, step: 0.01, default: 0.55, reinit: true },
    { key: "growth", label: "Growth p", min: 0, max: 0.05, step: 0.001, default: 0.012 },
    { key: "lightning", label: "Lightning f", min: 0, max: 0.002, step: 0.00002, default: 0.0001 },
  ],
  series: [
    { key: "treePct", label: "Tree %", color: "#9ece6a" },
    { key: "burning", label: "Burning", color: "#ff9d3d" },
  ],
  chartMode: "normalized",
  maxStepsPerFrame: 16,

  init(seed: number, p: Params): FireState {
    const rng = new Rng(seed);
    const grid = makeGrid(W, H);
    for (let i = 0; i < grid.cells.length; i++) {
      grid.cells[i] = rng.bool(p.density) ? TREE : EMPTY;
    }
    return { grid, rngState: rng.state(), tick: 0 };
  },

  step(s: FireState, p: Params): FireState {
    const rng = Rng.fromState(s.rngState);
    const g = s.grid;
    const next = new Uint8Array(g.cells.length);
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const i = y * g.w + x;
        const cell = g.cells[i];
        if (cell === BURNING) {
          next[i] = EMPTY;
        } else if (cell === TREE) {
          const neighborOnFire = countWrap(g, x, y, BURNING, MOORE) > 0;
          next[i] = neighborOnFire || rng.bool(p.lightning) ? BURNING : TREE;
        } else {
          next[i] = rng.bool(p.growth) ? TREE : EMPTY;
        }
      }
    }
    return {
      grid: { w: g.w, h: g.h, cells: next },
      rngState: rng.state(),
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    const flicker = s.tick % 2 === 0;
    paintGrid(ctx, view, s.grid, "fire", (v, i) => {
      if (v === TREE) return C_TREE;
      if (v === BURNING) return (i + (flicker ? 0 : 1)) % 2 === 0 ? C_BURN_A : C_BURN_B;
      return C_EMPTY;
    });
  },

  stats(s) {
    let trees = 0;
    let burning = 0;
    for (let i = 0; i < s.grid.cells.length; i++) {
      const v = s.grid.cells[i];
      if (v === TREE) trees++;
      else if (v === BURNING) burning++;
    }
    return {
      tick: s.tick,
      treePct: (100 * trees) / s.grid.cells.length,
      burning,
    };
  },

  onPointer(s, x, y, _buttons) {
    const cx = Math.floor(x * W);
    const cy = Math.floor(y * H);
    const next = s.grid.cells.slice();
    const i = cy * W + cx;
    if (next[i] === TREE) next[i] = BURNING;
    return { ...s, grid: { w: W, h: H, cells: next } };
  },
};
