import { Rng } from "../core/rng.js";
import { makeGridOf, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb, rgb } from "../ui/painter.js";

export interface DlaState {
  /** 0 = empty; otherwise the order in which the cell joined the cluster. */
  readonly grid: Grid<Int32Array>;
  readonly size: number;
  readonly maxRadius: number;
  readonly rngState: number;
  readonly tick: number;
}

const W = 192;
const H = 128;
const CX = W >> 1;
const CY = H >> 1;
const WALK_BUDGET = 6000;
const C_BG = rgb(10, 12, 16);
const OLD: [number, number, number] = [40, 60, 140];
const MID: [number, number, number] = [80, 190, 220];
const NEW: [number, number, number] = [245, 250, 255];

function nearCluster(cells: Int32Array, x: number, y: number): boolean {
  if (x > 0 && cells[y * W + x - 1] > 0) return true;
  if (x < W - 1 && cells[y * W + x + 1] > 0) return true;
  if (y > 0 && cells[(y - 1) * W + x] > 0) return true;
  if (y < H - 1 && cells[(y + 1) * W + x] > 0) return true;
  return false;
}

export const dla: Simulation<DlaState> = {
  id: "dla",
  name: "Coral Growth (DLA)",
  blurb: "Fractals from drunken walks",
  description:
    "Particles wander in from far away on random walks and freeze where they first " +
    "touch the structure. That single rule grows branching coral — because a random " +
    "walker is overwhelmingly likely to hit a branch tip before it threads its way " +
    "into a crevice. The fractal is the shadow of a probability distribution.",
  whatToTry:
    "Lower stickiness: particles bounce off a few times before settling, sneak deeper " +
    "into the gaps, and the coral grows fat and dense instead of wispy.",
  params: [
    { key: "walkers", label: "Walkers / step", min: 1, max: 64, step: 1, default: 12 },
    { key: "stickiness", label: "Stickiness", min: 0.05, max: 1, step: 0.05, default: 1 },
  ],
  series: [{ key: "size", label: "Cluster size", color: "#7ad7ff" }],
  maxStepsPerFrame: 32,

  init(seed: number, _p: Params): DlaState {
    const grid = makeGridOf(W, H, Int32Array);
    grid.cells[CY * W + CX] = 1;
    return { grid, size: 1, maxRadius: 0, rngState: new Rng(seed).state(), tick: 0 };
  },

  step(s: DlaState, p: Params): DlaState {
    const rng = Rng.fromState(s.rngState);
    const cells = s.grid.cells.slice();
    let size = s.size;
    let maxRadius = s.maxRadius;

    for (let n = 0; n < p.walkers; n++) {
      const spawnR = Math.min(Math.min(W, H) / 2 - 2, maxRadius + 6);
      const killR = spawnR + 12;
      const theta = rng.range(0, Math.PI * 2);
      let x = Math.round(CX + Math.cos(theta) * spawnR);
      let y = Math.round(CY + Math.sin(theta) * spawnR);

      for (let t = 0; t < WALK_BUDGET; t++) {
        if (nearCluster(cells, x, y) && rng.bool(p.stickiness)) {
          size++;
          cells[y * W + x] = size;
          const r = Math.hypot(x - CX, y - CY);
          if (r > maxRadius) maxRadius = r;
          break;
        }
        const dir = rng.int(4);
        x += dir === 0 ? 1 : dir === 1 ? -1 : 0;
        y += dir === 2 ? 1 : dir === 3 ? -1 : 0;
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) break;
        const dx = x - CX;
        const dy = y - CY;
        if (dx * dx + dy * dy > killR * killR) break;
      }
    }

    return {
      grid: { w: W, h: H, cells },
      size,
      maxRadius,
      rngState: rng.state(),
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    const total = Math.max(2, s.size);
    paintGrid(ctx, view, s.grid, "dla", (v) => {
      if (v === 0) return C_BG;
      const age = v / total;
      return age < 0.6 ? lerpRgb(OLD, MID, age / 0.6) : lerpRgb(MID, NEW, (age - 0.6) / 0.4);
    });
  },

  stats(s) {
    return { tick: s.tick, size: s.size, radius: Math.round(s.maxRadius * 10) / 10 };
  },
};

export const DLA_WORLD = { w: W, h: H };
