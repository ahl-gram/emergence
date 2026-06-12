import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb, rgb } from "../ui/painter.js";

export interface OpinionsState {
  /** Opinions in [0, 1]; the first `zealotCount` agents never move. */
  readonly opinions: ReadonlyArray<number>;
  readonly zealotCount: number;
  readonly rngState: number;
  readonly tick: number;
  /** Density rows for the time-scroll view (one Uint8 bin row per step). */
  readonly history: ReadonlyArray<Uint8Array>;
}

const BINS = 480;
const ROWS = 320;
const ZEALOT_OPINION = 0.95;
const BG: [number, number, number] = [10, 12, 16];
const STREAM: [number, number, number] = [122, 215, 255];
const C_ZEALOT_COL = rgb(255, 90, 80);

function snapshot(opinions: ReadonlyArray<number>): Uint8Array {
  const row = new Uint8Array(BINS);
  for (const x of opinions) {
    const bin = Math.min(BINS - 1, Math.floor(x * BINS));
    if (row[bin] < 255) row[bin]++;
  }
  return row;
}

/** Count opinion clusters: gaps wider than half the confidence bound split groups. */
export function clusterCount(opinions: ReadonlyArray<number>, epsilon: number): number {
  if (opinions.length === 0) return 0;
  const sorted = [...opinions].sort((a, b) => a - b);
  let clusters = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > Math.max(0.01, epsilon / 2)) clusters++;
  }
  return clusters;
}

export const opinions: Simulation<OpinionsState> = {
  id: "opinions",
  name: "Opinion Dynamics",
  blurb: "Echo chambers from open minds",
  description:
    "Everyone holds an opinion on a line. When two people meet, they compromise — " +
    "but only if they already stand within a confidence bound of each other; anyone " +
    "further away is ignored. Time scrolls downward: watch a uniform spread of views " +
    "braid itself into a few rivers that never touch again. Nobody chose a camp; " +
    "the camps chose themselves.",
  whatToTry:
    "Confidence 0.5 reaches one consensus; 0.1 freezes several camps — roughly " +
    "1/(2×confidence) of them. Add zealots (fixed at 0.95) and watch a stubborn " +
    "minority quietly drag the whole drifting middle toward its corner.",
  params: [
    { key: "agents", label: "People", min: 100, max: 2000, step: 50, default: 600, reinit: true },
    { key: "epsilon", label: "Confidence bound", min: 0.02, max: 0.6, step: 0.01, default: 0.18 },
    { key: "mu", label: "Compromise rate", min: 0.05, max: 0.5, step: 0.05, default: 0.5 },
    { key: "zealots", label: "Zealot fraction", min: 0, max: 0.2, step: 0.01, default: 0, reinit: true },
  ],
  series: [
    { key: "clusters", label: "Camps", color: "#7ad7ff" },
    { key: "spread", label: "Spread (std dev)", color: "#ff9d3d" },
  ],
  chartMode: "normalized",
  maxStepsPerFrame: 8,

  init(seed: number, p: Params): OpinionsState {
    const rng = new Rng(seed);
    const zealotCount = Math.floor(p.agents * p.zealots);
    const list: number[] = [];
    for (let i = 0; i < p.agents; i++) {
      list.push(i < zealotCount ? ZEALOT_OPINION : rng.next());
    }
    return {
      opinions: list,
      zealotCount,
      rngState: rng.state(),
      tick: 0,
      history: [snapshot(list)],
    };
  },

  step(s: OpinionsState, p: Params): OpinionsState {
    const rng = Rng.fromState(s.rngState);
    const x = [...s.opinions];
    const n = x.length;
    const order = rng.shuffled(x.map((_, i) => i));
    for (let k = 0; k + 1 < n; k += 2) {
      const i = order[k];
      const j = order[k + 1];
      if (Math.abs(x[i] - x[j]) >= p.epsilon) continue;
      const moveI = i >= s.zealotCount;
      const moveJ = j >= s.zealotCount;
      const di = p.mu * (x[j] - x[i]);
      const dj = p.mu * (x[i] - x[j]);
      if (moveI) x[i] += di;
      if (moveJ) x[j] += dj;
    }

    const history = [...s.history, snapshot(x)];
    if (history.length > ROWS) history.shift();

    return {
      opinions: x,
      zealotCount: s.zealotCount,
      rngState: rng.state(),
      tick: s.tick + 1,
      history,
    };
  },

  render(s, ctx, view) {
    const cells = new Uint8Array(BINS * ROWS);
    const offset = ROWS - s.history.length;
    s.history.forEach((row, r) => cells.set(row, (offset + r) * BINS));
    const grid = { w: BINS, h: ROWS, cells };
    const zealotBin = Math.floor(ZEALOT_OPINION * BINS);
    const hasZealots = s.zealotCount > 0;
    paintGrid(ctx, view, grid, "opinions", (v, i) => {
      if (v === 0) return rgb(BG[0], BG[1], BG[2]);
      const heat = Math.min(1, v / 6);
      if (hasZealots && i % BINS === zealotBin) return C_ZEALOT_COL;
      return lerpRgb(BG, STREAM, 0.35 + 0.65 * heat);
    });
  },

  stats(s, p) {
    const x = s.opinions;
    const n = x.length;
    let mean = 0;
    for (const v of x) mean += v;
    mean /= n;
    let sq = 0;
    for (const v of x) sq += (v - mean) ** 2;
    return {
      step: s.tick,
      clusters: clusterCount(x, p.epsilon),
      spread: Math.sqrt(sq / n),
      mean,
    };
  },
};
