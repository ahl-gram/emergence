import { Rng } from "../core/rng.js";
import { makeGrid, wrap, MOORE, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

export interface DilemmaState {
  /** 0 = cooperator, 1 = defector. */
  readonly grid: Grid<Uint8Array>;
  /** Last step's strategies, for transition coloring. */
  readonly prev: Grid<Uint8Array>;
  readonly rngState: number;
  readonly tick: number;
}

export const COOPERATE = 0;
export const DEFECT = 1;

const W = 120;
const H = 80;
const C_STAY_C = rgb(74, 125, 208); // blue: loyal cooperator
const C_STAY_D = rgb(208, 74, 74); // red: hardened defector
const C_TO_D = rgb(255, 210, 74); // gold: just defected
const C_TO_C = rgb(126, 224, 138); // green: just converted to cooperation

/**
 * Nowak–May payoff: a cooperator earns 1 per cooperating neighbor;
 * a defector earns b per cooperating neighbor; all else pays 0.
 */
function payoffs(g: Grid<Uint8Array>, b: number): Float32Array {
  const out = new Float32Array(g.cells.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let cNeighbors = 0;
      for (const [dx, dy] of MOORE) {
        if (g.cells[wrap(y + dy, H) * W + wrap(x + dx, W)] === COOPERATE) cNeighbors++;
      }
      out[i] = cNeighbors * (g.cells[i] === COOPERATE ? 1 : b);
    }
  }
  return out;
}

export const dilemma: Simulation<DilemmaState> = {
  id: "dilemma",
  name: "Cooperation Wars",
  blurb: "Why nice guys survive in patches",
  description:
    "Every cell plays the Prisoner's Dilemma with its neighbors, then copies its most " +
    "successful neighbor. Defectors beat any cooperator they touch — yet cooperators " +
    "persist by clustering, sharing payoffs inside blobs that defectors can only " +
    "nibble at the edges. Game theory says defect; geometry says cooperate. The war " +
    "between them paints endlessly shifting fractals.",
  whatToTry:
    "The default is the famous experiment: one defector in a perfect world unfolds " +
    "into a symmetric kaleidoscope. Drop b to 1.3 and the outbreak stays contained; " +
    "push past 2.2 and cooperation collapses. 'Random mix' shows a messy real world " +
    "freezing into separated camps.",
  params: [
    { key: "b", label: "Temptation b", min: 1, max: 2.5, step: 0.01, default: 1.85 },
    { key: "start", label: "Start", min: 0, max: 1, step: 1, default: 1, options: ["random mix", "single defector"], reinit: true },
    { key: "cFrac", label: "Cooperators", min: 0.1, max: 0.95, step: 0.05, default: 0.9, reinit: true },
  ],
  series: [{ key: "cooperators", label: "Cooperator fraction", color: "#4a7dd0" }],
  maxStepsPerFrame: 16,

  init(seed: number, p: Params): DilemmaState {
    const rng = new Rng(seed);
    const grid = makeGrid(W, H);
    if (p.start === 1) {
      grid.cells[(H >> 1) * W + (W >> 1)] = DEFECT;
    } else {
      for (let i = 0; i < grid.cells.length; i++) {
        grid.cells[i] = rng.bool(p.cFrac) ? COOPERATE : DEFECT;
      }
    }
    return { grid, prev: grid, rngState: rng.state(), tick: 0 };
  },

  step(s: DilemmaState, p: Params): DilemmaState {
    const score = payoffs(s.grid, p.b);
    const next = new Uint8Array(s.grid.cells.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let bestScore = score[i];
        let bestStrategy = s.grid.cells[i];
        for (const [dx, dy] of MOORE) {
          const j = wrap(y + dy, H) * W + wrap(x + dx, W);
          if (score[j] > bestScore) {
            bestScore = score[j];
            bestStrategy = s.grid.cells[j];
          }
        }
        next[i] = bestStrategy;
      }
    }
    return {
      grid: { w: W, h: H, cells: next },
      prev: s.grid,
      rngState: s.rngState,
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    const prev = s.prev.cells;
    paintGrid(ctx, view, s.grid, "dilemma", (v, i) => {
      if (v === COOPERATE) return prev[i] === COOPERATE ? C_STAY_C : C_TO_C;
      return prev[i] === DEFECT ? C_STAY_D : C_TO_D;
    });
  },

  stats(s) {
    let cooperators = 0;
    let changed = 0;
    for (let i = 0; i < s.grid.cells.length; i++) {
      if (s.grid.cells[i] === COOPERATE) cooperators++;
      if (s.grid.cells[i] !== s.prev.cells[i]) changed++;
    }
    return {
      round: s.tick,
      cooperators: cooperators / s.grid.cells.length,
      switched: changed,
    };
  },

  onPointer(s, x, y, buttons) {
    const cx = Math.floor(x * W);
    const cy = Math.floor(y * H);
    const value = buttons & 2 ? COOPERATE : DEFECT;
    const next = s.grid.cells.slice();
    next[wrap(cy, H) * W + wrap(cx, W)] = value;
    return { ...s, grid: { w: W, h: H, cells: next } };
  },
};

export const DILEMMA_WORLD = { w: W, h: H };
