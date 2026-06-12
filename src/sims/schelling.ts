import { Rng } from "../core/rng.js";
import { makeGrid, countWrap, MOORE, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface SchellingState {
  readonly grid: Grid<Uint8Array>;
  readonly rngState: number;
  readonly tick: number;
  readonly lastMoves: number;
}

const W = 120;
const H = 80;
const EMPTY = 0;
const COLORS = [rgb(13, 16, 24), rgb(122, 215, 255), rgb(255, 184, 107)];

function likeFraction(g: Grid<Uint8Array>, x: number, y: number, kind: number): number | null {
  const like = countWrap(g, x, y, kind, MOORE);
  const other = countWrap(g, x, y, kind === 1 ? 2 : 1, MOORE);
  if (like + other === 0) return null;
  return like / (like + other);
}

export const schelling: Simulation<SchellingState> = {
  id: "schelling",
  name: "Schelling Segregation",
  blurb: "Mild preferences, stark separation",
  description:
    "Two kinds of agents live on a grid. An agent is unhappy only if fewer than a " +
    "threshold fraction of its neighbors are like itself, and unhappy agents move to a " +
    "random empty cell. Even a mild 30% preference — agents perfectly content as a " +
    "minority — produces stark segregation. Individual tolerance, collective separation.",
  whatToTry:
    "Run threshold 0.3 and watch similarity climb far above what anyone 'wanted'. " +
    "Then try 0.75: demands that strong leave everyone unhappy, and the map churns forever.",
  params: [
    { key: "density", label: "Density", min: 0.5, max: 0.98, step: 0.01, default: 0.9, reinit: true },
    { key: "ratio", label: "Mix (A vs B)", min: 0.1, max: 0.9, step: 0.05, default: 0.5, reinit: true },
    { key: "threshold", label: "Wanted similarity", min: 0, max: 1, step: 0.05, default: 0.3 },
  ],
  series: [
    { key: "similarity", label: "Avg similarity", color: "#7ad7ff" },
    { key: "happy", label: "Happy fraction", color: "#9ece6a" },
  ],
  maxStepsPerFrame: 16,

  init(seed: number, p: Params): SchellingState {
    const rng = new Rng(seed);
    const grid = makeGrid(W, H);
    for (let i = 0; i < grid.cells.length; i++) {
      grid.cells[i] = rng.bool(p.density) ? (rng.bool(p.ratio) ? 1 : 2) : EMPTY;
    }
    return { grid, rngState: rng.state(), tick: 0, lastMoves: 0 };
  },

  step(s: SchellingState, p: Params): SchellingState {
    const rng = Rng.fromState(s.rngState);
    const g = s.grid;
    const unhappy: number[] = [];
    const empties: number[] = [];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const kind = g.cells[i];
        if (kind === EMPTY) {
          empties.push(i);
          continue;
        }
        const frac = likeFraction(g, x, y, kind);
        if (frac !== null && frac < p.threshold) unhappy.push(i);
      }
    }

    const next = g.cells.slice();
    const movers = rng.shuffled(unhappy);
    for (const from of movers) {
      if (empties.length === 0) break;
      const slot = rng.int(empties.length);
      const to = empties[slot];
      next[to] = next[from];
      next[from] = EMPTY;
      empties[slot] = from;
    }

    return {
      grid: { w: W, h: H, cells: next },
      rngState: rng.state(),
      tick: s.tick + 1,
      lastMoves: movers.length,
    };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.grid, "schelling", (v) => COLORS[v]);
  },

  stats(s, p) {
    const g = s.grid;
    let agents = 0;
    let withNeighbors = 0;
    let simSum = 0;
    let happy = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const kind = g.cells[y * W + x];
        if (kind === EMPTY) continue;
        agents++;
        const frac = likeFraction(g, x, y, kind);
        if (frac === null) {
          happy++;
          continue;
        }
        withNeighbors++;
        simSum += frac;
        if (frac >= p.threshold) happy++;
      }
    }
    return {
      tick: s.tick,
      similarity: withNeighbors > 0 ? simSum / withNeighbors : 1,
      happy: agents > 0 ? happy / agents : 1,
      moved: s.lastMoves,
    };
  },
};
