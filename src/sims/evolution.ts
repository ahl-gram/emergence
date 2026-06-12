import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb, rgb } from "../ui/painter.js";

export interface EvolutionState {
  readonly fitness: ReadonlyArray<number>;
  readonly rngState: number;
  readonly tick: number;
  /** Quantized fitness rows for the space-time view; 255 marks a replacement. */
  readonly history: ReadonlyArray<Uint8Array>;
}

const N = 480;
const ROWS = 320;
const MARK = 255;
const LOW: [number, number, number] = [12, 14, 19];
const MID: [number, number, number] = [40, 90, 140];
const HIGH: [number, number, number] = [140, 220, 255];
const C_MARK = rgb(255, 90, 80);

/** The Bak–Sneppen critical fitness threshold (numerical, ≈ 0.667). */
export const BS_THRESHOLD = 0.667;

function snapshot(fitness: ReadonlyArray<number>, replaced: ReadonlyArray<number>): Uint8Array {
  const row = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    row[i] = Math.min(254, Math.floor(fitness[i] * 254));
  }
  for (const i of replaced) row[i] = MARK;
  return row;
}

export const evolution: Simulation<EvolutionState> = {
  id: "evolution",
  name: "Punctuated Equilibrium",
  blurb: "Evolution in fits and starts",
  description:
    "Species sit in a food chain; each has a random fitness. Evolution is brutal and " +
    "simple: the least fit species goes extinct, dragging its two neighbors with it, " +
    "and all three are replaced by newcomers. Time scrolls downward — extinctions " +
    "(red) cluster into avalanches separated by long calm. The ecosystem self-organizes " +
    "to a critical fitness bar (≈ 0.667) that nobody set, and stasis punctuated by " +
    "upheaval falls out of one greedy rule.",
  whatToTry:
    "Watch the red activity wander: avalanches in one spot, quiet everywhere else — " +
    "the fossil record's long boredoms and sudden mass extinctions. The chart shows " +
    "the survivor floor creeping up to two-thirds and sticking there.",
  params: [],
  series: [
    { key: "minFitness", label: "Weakest species", color: "#ff9d3d" },
    { key: "aboveBar", label: "Share above 0.667", color: "#7ad7ff" },
  ],
  maxStepsPerFrame: 64,

  init(seed: number, _p: Params): EvolutionState {
    const rng = new Rng(seed);
    const fitness = Array.from({ length: N }, () => rng.next());
    return {
      fitness,
      rngState: rng.state(),
      tick: 0,
      history: [snapshot(fitness, [])],
    };
  },

  step(s: EvolutionState, _p: Params): EvolutionState {
    const rng = Rng.fromState(s.rngState);
    const fitness = [...s.fitness];
    let weakest = 0;
    for (let i = 1; i < N; i++) {
      if (fitness[i] < fitness[weakest]) weakest = i;
    }
    const left = (weakest - 1 + N) % N;
    const right = (weakest + 1) % N;
    fitness[left] = rng.next();
    fitness[weakest] = rng.next();
    fitness[right] = rng.next();

    const history = [...s.history, snapshot(fitness, [left, weakest, right])];
    if (history.length > ROWS) history.shift();

    return { fitness, rngState: rng.state(), tick: s.tick + 1, history };
  },

  render(s, ctx, view) {
    const cells = new Uint8Array(N * ROWS);
    const offset = ROWS - s.history.length;
    s.history.forEach((row, r) => cells.set(row, (offset + r) * N));
    paintGrid(ctx, view, { w: N, h: ROWS, cells }, "evolution", (v) => {
      if (v === MARK) return C_MARK;
      const f = v / 254;
      return f < 0.5 ? lerpRgb(LOW, MID, f * 2) : lerpRgb(MID, HIGH, (f - 0.5) * 2);
    });
  },

  stats(s) {
    let min = 1;
    let above = 0;
    for (const f of s.fitness) {
      if (f < min) min = f;
      if (f > BS_THRESHOLD) above++;
    }
    return {
      extinctions: s.tick,
      minFitness: min,
      aboveBar: above / N,
    };
  },
};

export const EVOLUTION_N = N;
