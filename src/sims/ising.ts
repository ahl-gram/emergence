import { Rng } from "../core/rng.js";
import { makeGrid, wrap, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface IsingState {
  /** 0 = spin down, 1 = spin up. */
  readonly grid: Grid<Uint8Array>;
  readonly rngState: number;
  readonly tick: number;
}

const W = 192;
const H = 128;
const C_UP = rgb(235, 240, 250);
const C_DOWN = rgb(28, 56, 104);

/** Critical temperature of the 2D Ising model: 2 / ln(1 + √2) ≈ 2.269. */
export const T_CRITICAL = 2 / Math.log(1 + Math.SQRT2);

function neighborSpinSum(cells: Uint8Array, x: number, y: number): number {
  const up = cells[wrap(y - 1, H) * W + x];
  const down = cells[wrap(y + 1, H) * W + x];
  const left = cells[y * W + wrap(x - 1, W)];
  const right = cells[y * W + wrap(x + 1, W)];
  // map {0,1} -> {-1,+1} and sum
  return 2 * (up + down + left + right) - 4;
}

export const ising: Simulation<IsingState> = {
  id: "ising",
  name: "Ising Magnet",
  blurb: "A phase transition you can scrub",
  description:
    "Each atom is a tiny magnet that wants to agree with its four neighbors, while " +
    "temperature jiggles it at random. Below a critical temperature the atoms " +
    "spontaneously pick a side and order spans the whole material; above it, thermal " +
    "noise wins and everything is salt-and-pepper. The change is not gradual — it is " +
    "a sharp phase transition, and this model is where physics first understood that.",
  whatToTry:
    "The default temperature is exactly critical — fractal islands at every size. " +
    "Drag T below 2 and watch domains coarsen and one side win; drag above 3.5 and " +
    "order melts. Paint with the mouse to carve magnetized regions and watch them heal.",
  params: [
    { key: "T", label: "Temperature", min: 0.5, max: 5, step: 0.01, default: Math.round(T_CRITICAL * 100) / 100 },
    { key: "start", label: "Start", min: 0, max: 1, step: 1, default: 0, options: ["random", "all up"], reinit: true },
  ],
  series: [
    { key: "magnetization", label: "Magnetization", color: "#7ad7ff" },
    { key: "energy", label: "Energy / spin", color: "#ff9d3d" },
  ],
  maxStepsPerFrame: 16,

  init(seed: number, p: Params): IsingState {
    const rng = new Rng(seed);
    const grid = makeGrid(W, H);
    if (p.start === 1) {
      grid.cells.fill(1);
    } else {
      for (let i = 0; i < grid.cells.length; i++) {
        grid.cells[i] = rng.bool(0.5) ? 1 : 0;
      }
    }
    return { grid, rngState: rng.state(), tick: 0 };
  },

  /** One step = one Monte Carlo sweep (W*H single-spin Metropolis attempts). */
  step(s: IsingState, p: Params): IsingState {
    const rng = Rng.fromState(s.rngState);
    const cells = s.grid.cells.slice();
    const beta = 1 / Math.max(0.01, p.T);
    const n = cells.length;
    for (let a = 0; a < n; a++) {
      const i = rng.int(n);
      const x = i % W;
      const y = (i - x) / W;
      const spin = 2 * cells[i] - 1;
      const dE = 2 * spin * neighborSpinSum(cells, x, y);
      if (dE <= 0 || rng.next() < Math.exp(-dE * beta)) {
        cells[i] = 1 - cells[i];
      }
    }
    return { grid: { w: W, h: H, cells }, rngState: rng.state(), tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.grid, "ising", (v) => (v === 1 ? C_UP : C_DOWN));
  },

  stats(s) {
    const cells = s.grid.cells;
    let sum = 0;
    let bonds = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const spin = 2 * cells[y * W + x] - 1;
        sum += spin;
        const right = 2 * cells[y * W + wrap(x + 1, W)] - 1;
        const below = 2 * cells[wrap(y + 1, H) * W + x] - 1;
        bonds += spin * right + spin * below;
      }
    }
    const n = cells.length;
    return {
      sweep: s.tick,
      magnetization: sum / n,
      energy: -bonds / n,
    };
  },

  onPointer(s, x, y, buttons) {
    const cx = Math.floor(x * W);
    const cy = Math.floor(y * H);
    const value = buttons & 2 ? 0 : 1;
    const next = s.grid.cells.slice();
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        next[wrap(cy + dy, H) * W + wrap(cx + dx, W)] = value;
      }
    }
    return { ...s, grid: { w: W, h: H, cells: next } };
  },
};

export const ISING_WORLD = { w: W, h: H };
