import { Rng } from "../core/rng.js";
import { makeGridOf, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface SandpileState {
  readonly grid: Grid<Int16Array>;
  readonly dropped: number;
  readonly lost: number;
  readonly lastAvalanche: number;
  readonly rngState: number;
  readonly tick: number;
}

const W = 151;
const H = 101;
const PALETTE = [rgb(10, 12, 16), rgb(36, 68, 120), rgb(62, 140, 200), rgb(170, 222, 255)];

/**
 * Drop one grain at (x, y) and relax until every cell is below 4.
 * Grains toppling past the edge are lost (open boundary).
 * Returns the number of topplings (avalanche size) and grains lost.
 */
export function dropAndRelax(
  cells: Int16Array,
  x: number,
  y: number,
): { toppled: number; lost: number } {
  let toppled = 0;
  let lost = 0;
  cells[y * W + x]++;
  const unstable: number[] = [];
  if (cells[y * W + x] >= 4) unstable.push(y * W + x);

  while (unstable.length > 0) {
    const i = unstable.pop()!;
    if (cells[i] < 4) continue;
    cells[i] -= 4;
    toppled++;
    const cx = i % W;
    const cy = (i - cx) / W;
    const spill: Array<[number, number]> = [
      [cx, cy - 1],
      [cx, cy + 1],
      [cx - 1, cy],
      [cx + 1, cy],
    ];
    for (const [nx, ny] of spill) {
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) {
        lost++;
        continue;
      }
      const ni = ny * W + nx;
      cells[ni]++;
      if (cells[ni] >= 4) unstable.push(ni);
    }
    if (cells[i] >= 4) unstable.push(i);
  }
  return { toppled, lost };
}

export const sandpile: Simulation<SandpileState> = {
  id: "sandpile",
  name: "Sandpile",
  blurb: "Avalanches of every size",
  description:
    "Drop grains on a table; any cell holding 4 topples one grain to each neighbor, " +
    "possibly toppling them in turn. The pile self-organizes to a critical slope where " +
    "the next grain might do nothing — or trigger an avalanche across the whole table. " +
    "Same grain, no way to tell in advance. Watch the avalanche chart spike.",
  whatToTry:
    "Note the fractal pattern that forms — pure arithmetic, no art directive. Set " +
    "spread to 0 for the perfect mandala; raise it and criticality survives the noise.",
  params: [
    { key: "grains", label: "Grains / step", min: 1, max: 64, step: 1, default: 8 },
    { key: "spread", label: "Drop spread", min: 0, max: 40, step: 1, default: 0 },
  ],
  series: [{ key: "avalanche", label: "Avalanche size", color: "#ff9d3d" }],
  maxStepsPerFrame: 64,

  init(seed: number, _p: Params): SandpileState {
    return {
      grid: makeGridOf(W, H, Int16Array),
      dropped: 0,
      lost: 0,
      lastAvalanche: 0,
      rngState: new Rng(seed).state(),
      tick: 0,
    };
  },

  step(s: SandpileState, p: Params): SandpileState {
    const rng = Rng.fromState(s.rngState);
    const cells = s.grid.cells.slice();
    let lost = s.lost;
    let avalanche = 0;
    for (let g = 0; g < p.grains; g++) {
      const ox = p.spread > 0 ? rng.int(2 * p.spread + 1) - p.spread : 0;
      const oy = p.spread > 0 ? rng.int(2 * p.spread + 1) - p.spread : 0;
      const x = Math.min(W - 1, Math.max(0, (W >> 1) + ox));
      const y = Math.min(H - 1, Math.max(0, (H >> 1) + oy));
      const result = dropAndRelax(cells, x, y);
      avalanche += result.toppled;
      lost += result.lost;
    }
    return {
      grid: { w: W, h: H, cells },
      dropped: s.dropped + p.grains,
      lost,
      lastAvalanche: avalanche,
      rngState: rng.state(),
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.grid, "sandpile", (v) => PALETTE[Math.min(3, v)]);
  },

  stats(s) {
    let onBoard = 0;
    for (let i = 0; i < s.grid.cells.length; i++) onBoard += s.grid.cells[i];
    return {
      tick: s.tick,
      grains: onBoard,
      avalanche: s.lastAvalanche,
      lostOffEdge: s.lost,
    };
  },
};

export const SANDPILE_WORLD = { w: W, h: H };
