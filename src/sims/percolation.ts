import { Rng } from "../core/rng.js";
import { makeGridOf, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface PercolationState {
  /** Fixed random threshold per site; a site is open when threshold < porosity. */
  readonly thresholds: Grid<Float32Array>;
  /** Derived per step: 0 closed, 1 open-and-dry, 2 wet (connected to the top). */
  readonly wet: Grid<Uint8Array>;
  readonly percolates: boolean;
  readonly rngState: number;
  readonly tick: number;
}

const W = 192;
const H = 128;
const C_ROCK = rgb(16, 18, 24);
const C_DRY = rgb(70, 80, 100);
const C_WET = rgb(86, 196, 255);
const C_BREAKTHROUGH = rgb(160, 235, 255);

/** Site percolation threshold for the square lattice (numerical, ~0.5927). */
export const P_CRITICAL = 0.5927;

function floodFromTop(thresholds: Float32Array, porosity: number): { wet: Uint8Array; percolates: boolean } {
  const wet = new Uint8Array(thresholds.length);
  for (let i = 0; i < thresholds.length; i++) {
    if (thresholds[i] < porosity) wet[i] = 1;
  }
  const stack: number[] = [];
  for (let x = 0; x < W; x++) {
    if (wet[x] === 1) {
      wet[x] = 2;
      stack.push(x);
    }
  }
  let percolates = false;
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % W;
    const y = (i - x) / W;
    if (y === H - 1) percolates = true;
    if (x > 0 && wet[i - 1] === 1) { wet[i - 1] = 2; stack.push(i - 1); }
    if (x < W - 1 && wet[i + 1] === 1) { wet[i + 1] = 2; stack.push(i + 1); }
    if (y > 0 && wet[i - W] === 1) { wet[i - W] = 2; stack.push(i - W); }
    if (y < H - 1 && wet[i + W] === 1) { wet[i + W] = 2; stack.push(i + W); }
  }
  return { wet, percolates };
}

export const percolation: Simulation<PercolationState> = {
  id: "percolation",
  name: "Percolation",
  blurb: "The phase transition hiding in coffee",
  description:
    "Rock with random pores; water soaks in from the top. Below a critical porosity " +
    "the water wets isolated pockets and stops. At p ≈ 0.593 — not gradually, but " +
    "suddenly — a single connected channel spans the world and everything changes. " +
    "Coffee brewing, forest fires, oil fields, and internet outages all share this " +
    "same razor edge between 'nothing gets through' and 'everything does'.",
  whatToTry:
    "Scrub porosity slowly through 0.59 and watch the wet region jump from fingers " +
    "to flood. The same sites are open either way — connectivity, not quantity, is " +
    "what flips. Reset for new rock; the threshold barely moves. That's universality.",
  params: [
    { key: "porosity", label: "Porosity p", min: 0, max: 1, step: 0.002, default: 0.55 },
  ],
  series: [{ key: "wetFraction", label: "Wet fraction", color: "#56c4ff" }],
  maxStepsPerFrame: 4,

  init(seed: number, _p: Params): PercolationState {
    const rng = new Rng(seed);
    const thresholds = makeGridOf(W, H, Float32Array);
    for (let i = 0; i < thresholds.cells.length; i++) {
      thresholds.cells[i] = rng.next();
    }
    const wet = makeGridOf(W, H, Uint8Array);
    return {
      thresholds,
      wet,
      percolates: false,
      rngState: rng.state(),
      tick: 0,
    };
  },

  step(s: PercolationState, p: Params): PercolationState {
    const { wet, percolates } = floodFromTop(s.thresholds.cells, p.porosity);
    return {
      thresholds: s.thresholds,
      wet: { w: W, h: H, cells: wet },
      percolates,
      rngState: s.rngState,
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    const breakthrough = s.percolates;
    paintGrid(ctx, view, s.wet, "percolation", (v) => {
      if (v === 2) return breakthrough ? C_BREAKTHROUGH : C_WET;
      if (v === 1) return C_DRY;
      return C_ROCK;
    });
  },

  stats(s, p) {
    let open = 0;
    let wet = 0;
    for (const v of s.wet.cells) {
      if (v >= 1) open++;
      if (v === 2) wet++;
    }
    return {
      porosity: p.porosity,
      openFraction: open / s.wet.cells.length,
      wetFraction: wet / s.wet.cells.length,
      percolates: s.percolates ? 1 : 0,
    };
  },
};

export const PERC_WORLD = { w: W, h: H };
