import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, rgb } from "../ui/painter.js";

const N = 28; // grid side
const CELLS = N * N;

export interface HopfieldState {
  /** Neuron states, +1 or -1, length CELLS. */
  readonly s: Int8Array;
  /** Index of the stored pattern this run was seeded from. */
  readonly target: number;
  readonly rngState: number;
  readonly tick: number;
  readonly converged: boolean;
}

const ON = rgb(122, 215, 255);
const OFF = rgb(14, 17, 24);

/** Four procedurally-generated, visually distinct memories on the NxN grid. */
function makePatterns(): Int8Array[] {
  const c = (N - 1) / 2;
  const pats: Int8Array[] = [];
  const build = (f: (x: number, y: number) => boolean) => {
    const p = new Int8Array(CELLS);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) p[y * N + x] = f(x, y) ? 1 : -1;
    }
    pats.push(p);
  };
  // near-orthogonal textures (pairwise correlation ~0.01) so each is a clean
  // attractor with perfect recall; overlapping shapes like disk+ring crosstalk
  build((x) => Math.floor(x / 3) % 2 === 0); // vertical bars
  build((_x, y) => Math.floor(y / 3) % 2 === 0); // horizontal bars
  build((x, y) => (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0); // checker
  build((x, y) => Math.floor((x + y) / 4) % 2 === 0); // diagonal
  void c;
  return pats;
}

const PATTERNS = makePatterns();

/** Hebbian weights with zero diagonal, stored as a flat Float32Array. */
function buildWeights(patterns: Int8Array[]): Float32Array {
  const w = new Float32Array(CELLS * CELLS);
  for (const p of patterns) {
    for (let i = 0; i < CELLS; i++) {
      const pi = p[i];
      if (pi === 0) continue;
      const row = i * CELLS;
      for (let j = 0; j < CELLS; j++) {
        if (i !== j) w[row + j] += pi * p[j];
      }
    }
  }
  for (let i = 0; i < CELLS * CELLS; i++) w[i] /= CELLS;
  return w;
}

const WEIGHTS = buildWeights(PATTERNS);

export function energy(s: Int8Array): number {
  let e = 0;
  for (let i = 0; i < CELLS; i++) {
    const row = i * CELLS;
    let field = 0;
    for (let j = 0; j < CELLS; j++) field += WEIGHTS[row + j] * s[j];
    e -= field * s[i];
  }
  return e / 2;
}

function overlap(s: Int8Array, p: Int8Array): number {
  let dot = 0;
  for (let i = 0; i < CELLS; i++) dot += s[i] * p[i];
  return dot / CELLS;
}

export const hopfield: Simulation<HopfieldState> = {
  id: "hopfield",
  name: "Associative Memory",
  blurb: "A network that remembers by settling",
  description:
    "Every pixel is a neuron wired to all the others, with connections trained (Hebb's " +
    "rule: fire together, wire together) to store four pictures. Show the network a " +
    "corrupted image and each neuron simply flips to agree with the crowd pulling on " +
    "it. With no search and no labels, the whole grid slides downhill in energy and " +
    "settles into the closest stored memory. This is a Hopfield network — the seed of " +
    "modern associative memory, and a cousin of the attention that powers today's AI.",
  whatToTry:
    "Crank the corruption up: even at 40% noise the network usually reconstructs the " +
    "original. Paint on the canvas to damage it yourself and watch it heal. Push noise " +
    "past 50% and it sometimes falls into the wrong memory — or a spurious blend, the " +
    "failure mode that limits how much one net can store.",
  params: [
    { key: "target", label: "Memory", min: 0, max: 3, step: 1, default: 0, options: ["vertical", "horizontal", "checker", "diagonal"], reinit: true },
    { key: "noise", label: "Corruption", min: 0, max: 0.6, step: 0.02, default: 0.3, reinit: true },
  ],
  series: [
    { key: "recall", label: "Overlap with target", color: "#7ad7ff" },
    { key: "energy", label: "Energy", color: "#ff9d3d" },
  ],
  chartMode: "normalized",
  maxStepsPerFrame: 4,

  init(seed: number, p: Params): HopfieldState {
    const rng = new Rng(seed);
    const target = Math.max(0, Math.min(PATTERNS.length - 1, Math.round(p.target)));
    const s = PATTERNS[target].slice();
    for (let i = 0; i < CELLS; i++) {
      if (rng.bool(p.noise)) s[i] = -s[i] as -1 | 1;
    }
    return { s, target, rngState: rng.state(), tick: 0, converged: false };
  },

  /** One asynchronous sweep: update every neuron once, in a fixed shuffled order. */
  step(state: HopfieldState, _p: Params): HopfieldState {
    if (state.converged) return state;
    const rng = Rng.fromState(state.rngState);
    const s = state.s.slice();
    const order = rng.shuffled(Array.from({ length: CELLS }, (_, i) => i));
    let flips = 0;
    for (const i of order) {
      const row = i * CELLS;
      let field = 0;
      for (let j = 0; j < CELLS; j++) field += WEIGHTS[row + j] * s[j];
      const ns = field >= 0 ? 1 : -1;
      if (ns !== s[i]) {
        s[i] = ns as -1 | 1;
        flips++;
      }
    }
    return {
      s,
      target: state.target,
      rngState: rng.state(),
      tick: state.tick + 1,
      converged: flips === 0,
    };
  },

  render(state, ctx, view) {
    paintGrid(ctx, view, { w: N, h: N, cells: state.s as unknown as Int16Array }, "hopfield", (v) =>
      v === 1 ? ON : OFF,
    );
  },

  stats(state) {
    let best = -Infinity;
    let bestIdx = 0;
    for (let k = 0; k < PATTERNS.length; k++) {
      const o = overlap(state.s, PATTERNS[k]);
      if (o > best) {
        best = o;
        bestIdx = k;
      }
    }
    return {
      sweep: state.tick,
      recall: overlap(state.s, PATTERNS[state.target]),
      nearestMemory: bestIdx,
      energy: energy(state.s),
    };
  },

  onPointer(state, x, y, buttons) {
    const cx = Math.floor(x * N);
    const cy = Math.floor(y * N);
    const value = buttons & 2 ? -1 : 1;
    const s = state.s.slice();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < N && py >= 0 && py < N) s[py * N + px] = value as -1 | 1;
      }
    }
    return { ...state, s, converged: false };
  },
};

export const HOPFIELD_N = N;
export { PATTERNS as HOPFIELD_PATTERNS };
