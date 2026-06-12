import { Rng } from "../core/rng.js";
import { makeGrid, idx, wrap, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface LifeState {
  readonly grid: Grid<Uint8Array>;
  readonly generation: number;
  readonly rngState: number;
}

const W = 240;
const H = 160;
const ALIVE = rgb(122, 215, 255);
const DEAD = rgb(11, 14, 20);

function countMoore(cells: Uint8Array, w: number, h: number, x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    const ny = wrap(y + dy, h) * w;
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      n += cells[ny + wrap(x + dx, w)];
    }
  }
  return n;
}

export const life: Simulation<LifeState> = {
  id: "life",
  name: "Game of Life",
  blurb: "The classic cellular automaton",
  description:
    "Each cell looks only at its eight neighbors: a live cell survives with 2 or 3 " +
    "live neighbors, a dead cell becomes alive with exactly 3. Nobody plans gliders, " +
    "oscillators, or stable colonies — they fall out of two counting rules.",
  whatToTry:
    "Draw with the mouse while paused (right-drag erases), then press space. " +
    "Start from density 0.05 vs 0.5 and watch which one collapses faster.",
  params: [
    { key: "density", label: "Initial density", min: 0, max: 1, step: 0.01, default: 0.3, reinit: true },
  ],
  maxStepsPerFrame: 16,
  series: [{ key: "population", label: "Population", color: "#7ad7ff" }],

  init(seed: number, p: Params): LifeState {
    const rng = new Rng(seed);
    const grid = makeGrid(W, H);
    for (let i = 0; i < grid.cells.length; i++) {
      grid.cells[i] = rng.bool(p.density) ? 1 : 0;
    }
    return { grid, generation: 0, rngState: rng.state() };
  },

  step(s: LifeState, _p: Params): LifeState {
    const { w, h, cells } = s.grid;
    const next = new Uint8Array(cells.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const n = countMoore(cells, w, h, x, y);
        next[i] = cells[i] === 1 ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
      }
    }
    return { grid: { w, h, cells: next }, generation: s.generation + 1, rngState: s.rngState };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.grid, "life", (v) => (v === 1 ? ALIVE : DEAD));
  },

  stats(s) {
    let population = 0;
    for (let i = 0; i < s.grid.cells.length; i++) population += s.grid.cells[i];
    return { generation: s.generation, population };
  },

  onPointer(s, x, y, buttons, _p) {
    const { w, h } = s.grid;
    const cx = Math.floor(x * w);
    const cy = Math.floor(y * h);
    const value = buttons & 2 ? 0 : 1;
    const next = s.grid.cells.slice();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        next[idx(s.grid, wrap(cx + dx, w), wrap(cy + dy, h))] = value;
      }
    }
    return { ...s, grid: { w, h, cells: next } };
  },
};
