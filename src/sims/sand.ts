import { Rng } from "../core/rng.js";
import { makeGrid, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface SandState {
  readonly grid: Grid<Uint8Array>;
  readonly rngState: number;
  readonly tick: number;
}

export const AIR = 0;
export const WALL = 1;
export const SAND = 2;
export const WATER = 3;

const W = 192;
const H = 128;
const C_AIR = rgb(10, 12, 16);
const C_WALL = rgb(90, 97, 110);
const SAND_A = rgb(217, 179, 106);
const SAND_B = rgb(196, 158, 88);
const WATER_A = rgb(74, 163, 255);
const WATER_B = rgb(58, 140, 230);

const BRUSHES = ["sand", "water", "wall", "erase"] as const;
const BRUSH_VALUES = [SAND, WATER, WALL, AIR];

function buildScene(): Grid<Uint8Array> {
  const g = makeGrid(W, H);
  const set = (x: number, y: number, v: number) => {
    if (x >= 0 && x < W && y >= 0 && y < H) g.cells[y * W + x] = v;
  };
  // funnel
  for (let i = 0; i < 46; i++) {
    set(50 + i, 30 + i, WALL);
    set(W - 50 - i, 30 + i, WALL);
  }
  // two ledges
  for (let x = 20; x < 75; x++) set(x, 100, WALL);
  for (let x = W - 75; x < W - 20; x++) set(x, 88, WALL);
  return g;
}

export const sand: Simulation<SandState> = {
  id: "sand",
  name: "Falling Sand",
  blurb: "A physics toy from neighbor rules",
  description:
    "No gravity equation anywhere — just per-cell rules: sand moves down or " +
    "diagonally down, water also slides sideways, walls never move. Piles form " +
    "their angle of repose and water finds its level because of what cells do, " +
    "not because anyone computed a surface.",
  whatToTry:
    "Paint with the mouse — pick a brush below. Build a dam of walls, pool water " +
    "behind it, then erase one wall cell and watch the breach.",
  params: [
    { key: "sandRate", label: "Sand pour", min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: "waterRate", label: "Water pour", min: 0, max: 1, step: 0.05, default: 0.35 },
    { key: "brush", label: "Brush", min: 0, max: 3, step: 1, default: 0, options: BRUSHES },
  ],
  maxStepsPerFrame: 16,

  init(_seed: number, _p: Params): SandState {
    return { grid: buildScene(), rngState: 1, tick: 0 };
  },

  step(s: SandState, p: Params): SandState {
    const rng = Rng.fromState(s.rngState);
    const cells = s.grid.cells.slice();

    const swap = (a: number, b: number) => {
      const t = cells[a];
      cells[a] = cells[b];
      cells[b] = t;
    };

    for (let y = H - 2; y >= 0; y--) {
      const leftFirst = rng.bool(0.5);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const kind = cells[i];
        if (kind !== SAND && kind !== WATER) continue;
        const below = i + W;

        if (cells[below] === AIR || (kind === SAND && cells[below] === WATER)) {
          swap(i, below);
          continue;
        }

        const dirs = leftFirst ? [-1, 1] : [1, -1];
        let moved = false;
        for (const dx of dirs) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          const diag = below + dx;
          if (cells[diag] === AIR) {
            swap(i, diag);
            moved = true;
            break;
          }
        }
        if (moved || kind === SAND) continue;

        for (const dx of dirs) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          const side = i + dx;
          if (cells[side] === AIR) {
            swap(i, side);
            break;
          }
        }
      }
    }

    if (rng.bool(p.sandRate) && cells[2 * W + 70] === AIR) cells[2 * W + 70] = SAND;
    if (rng.bool(p.waterRate) && cells[2 * W + (W - 70)] === AIR) cells[2 * W + (W - 70)] = WATER;

    return {
      grid: { w: W, h: H, cells },
      rngState: rng.state(),
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.grid, "sand", (v, i) => {
      if (v === SAND) return (i * 31) % 3 === 0 ? SAND_B : SAND_A;
      if (v === WATER) return (i * 17) % 4 === 0 ? WATER_B : WATER_A;
      if (v === WALL) return C_WALL;
      return C_AIR;
    });
  },

  stats(s) {
    let sandCount = 0;
    let waterCount = 0;
    for (const v of s.grid.cells) {
      if (v === SAND) sandCount++;
      else if (v === WATER) waterCount++;
    }
    return { tick: s.tick, sand: sandCount, water: waterCount };
  },

  onPointer(s, x, y, buttons, p) {
    const value = buttons & 2 ? AIR : BRUSH_VALUES[p.brush] ?? SAND;
    const cx = Math.floor(x * W);
    const cy = Math.floor(y * H);
    const next = s.grid.cells.slice();
    const r = value === WALL || value === AIR ? 1 : 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        if (dx * dx + dy * dy > r * r + 1) continue;
        next[py * W + px] = value;
      }
    }
    return { ...s, grid: { w: W, h: H, cells: next } };
  },
};

export const SAND_WORLD = { w: W, h: H };
