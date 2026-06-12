import { Rng } from "../core/rng.js";
import { makeGrid, wrap, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface BrainState {
  readonly grid: Grid<Uint8Array>;
  readonly rngState: number;
  readonly tick: number;
}

export const OFF = 0;
export const FIRING = 1;
export const REFRACTORY = 2;

const W = 240;
const H = 160;
const C_OFF = rgb(9, 11, 15);
const C_FIRING = rgb(170, 230, 255);
const C_REFRACTORY = rgb(50, 90, 160);

export const brain: Simulation<BrainState> = {
  id: "brain",
  name: "Brian's Brain",
  blurb: "A universe overrun by spaceships",
  description:
    "Like Life, but cells that fire must rest before firing again — an off cell " +
    "ignites only when exactly two neighbors are firing, then spends a step " +
    "refractory. That tiny memory changes everything: instead of settling down, " +
    "the world fills with gliders launching gliders, forever. Neurons work this " +
    "way too; so do excitable media like heart tissue.",
  whatToTry:
    "Watch any collision — debris organizes itself into new spaceships almost " +
    "every time. Start from density 0.02 and a single spark population still " +
    "ignites the whole sky.",
  params: [
    { key: "density", label: "Initial firing", min: 0, max: 0.6, step: 0.01, default: 0.25, reinit: true },
  ],
  series: [{ key: "firing", label: "Firing cells", color: "#aae6ff" }],
  maxStepsPerFrame: 16,

  init(seed: number, p: Params): BrainState {
    const rng = new Rng(seed);
    const grid = makeGrid(W, H);
    for (let i = 0; i < grid.cells.length; i++) {
      grid.cells[i] = rng.bool(p.density) ? FIRING : OFF;
    }
    return { grid, rngState: rng.state(), tick: 0 };
  },

  step(s: BrainState, _p: Params): BrainState {
    const { w, h, cells } = s.grid;
    const next = new Uint8Array(cells.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (cells[i] === FIRING) {
          next[i] = REFRACTORY;
        } else if (cells[i] === REFRACTORY) {
          next[i] = OFF;
        } else {
          let firing = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = wrap(y + dy, h) * w;
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (cells[ny + wrap(x + dx, w)] === FIRING) firing++;
            }
          }
          next[i] = firing === 2 ? FIRING : OFF;
        }
      }
    }
    return { grid: { w, h, cells: next }, rngState: s.rngState, tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.grid, "brain", (v) =>
      v === FIRING ? C_FIRING : v === REFRACTORY ? C_REFRACTORY : C_OFF,
    );
  },

  stats(s) {
    let firing = 0;
    let refractory = 0;
    for (const v of s.grid.cells) {
      if (v === FIRING) firing++;
      else if (v === REFRACTORY) refractory++;
    }
    return { tick: s.tick, firing, refractory };
  },

  onPointer(s, x, y, _buttons) {
    const cx = Math.floor(x * W);
    const cy = Math.floor(y * H);
    const next = s.grid.cells.slice();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        next[wrap(cy + dy, H) * W + wrap(cx + dx, W)] = FIRING;
      }
    }
    return { ...s, grid: { w: W, h: H, cells: next } };
  },
};

export const BRAIN_WORLD = { w: W, h: H };
