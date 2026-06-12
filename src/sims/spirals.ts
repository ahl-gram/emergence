import { Rng } from "../core/rng.js";
import { makeGrid, wrap, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb } from "../ui/painter.js";

export interface SpiralsState {
  readonly grid: Grid<Uint8Array>;
  readonly rngState: number;
  readonly tick: number;
  readonly advancedLastStep: number;
}

const W = 240;
const H = 160;
const MAX_STATES = 20;

const ANCHORS: Array<[number, number, number]> = [
  [16, 24, 48],
  [40, 120, 180],
  [150, 230, 255],
  [255, 200, 120],
  [120, 40, 80],
];

function wheelColor(s: number, k: number): number {
  const t = (s / k) * (ANCHORS.length - 1);
  const i = Math.min(ANCHORS.length - 2, Math.floor(t));
  return lerpRgb(ANCHORS[i], ANCHORS[i + 1], t - i);
}

export const spirals: Simulation<SpiralsState> = {
  id: "spirals",
  name: "Spiral Waves",
  blurb: "The pattern heartbeats are made of",
  description:
    "Each cell cycles through K phases, but it may only advance when a neighbor is " +
    "already one phase ahead — excitation has to be handed to you. From random noise, " +
    "waves organize, collide, and wind up into rotating spirals that gnaw through " +
    "everything else. The same dynamics drive the Belousov–Zhabotinsky chemical clock " +
    "and electrical waves in heart muscle — where a rogue spiral is an arrhythmia.",
  whatToTry:
    "Wait through the droplet phase: noise → expanding rings → the first spiral, " +
    "which then takes over the world. Raise the threshold to 2 and waves need " +
    "consensus to propagate — the texture coarsens completely.",
  params: [
    { key: "states", label: "Phases K", min: 6, max: MAX_STATES, step: 1, default: 14, reinit: true },
    { key: "threshold", label: "Threshold", min: 1, max: 3, step: 1, default: 1 },
  ],
  series: [{ key: "activity", label: "Cells advancing", color: "#7ad7ff" }],
  maxStepsPerFrame: 16,

  init(seed: number, p: Params): SpiralsState {
    const rng = new Rng(seed);
    const grid = makeGrid(W, H);
    for (let i = 0; i < grid.cells.length; i++) {
      grid.cells[i] = rng.int(p.states);
    }
    return { grid, rngState: rng.state(), tick: 0, advancedLastStep: 0 };
  },

  step(s: SpiralsState, p: Params): SpiralsState {
    const k = p.states;
    const cells = s.grid.cells;
    const next = new Uint8Array(cells.length);
    let advanced = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const want = (cells[i] + 1) % k;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = wrap(y + dy, H) * W;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (cells[ny + wrap(x + dx, W)] === want) count++;
          }
        }
        if (count >= p.threshold) {
          next[i] = want;
          advanced++;
        } else {
          next[i] = cells[i];
        }
      }
    }
    return {
      grid: { w: W, h: H, cells: next },
      rngState: s.rngState,
      tick: s.tick + 1,
      advancedLastStep: advanced,
    };
  },

  render(s, ctx, view) {
    const k = Math.max(6, currentK(s));
    paintGrid(ctx, view, s.grid, "spirals", (v) => wheelColor(v, k));
  },

  stats(s) {
    return {
      tick: s.tick,
      activity: s.advancedLastStep / s.grid.cells.length,
    };
  },
};

function currentK(s: SpiralsState): number {
  let m = 0;
  for (let i = 0; i < s.grid.cells.length; i++) {
    if (s.grid.cells[i] > m) m = s.grid.cells[i];
  }
  return m + 1;
}

export const SPIRALS_WORLD = { w: W, h: H };
