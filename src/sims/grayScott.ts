import { Rng } from "../core/rng.js";
import { makeGridOf, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb } from "../ui/painter.js";

export interface GrayScottState {
  readonly u: Grid<Float32Array>;
  readonly v: Grid<Float32Array>;
  readonly rngState: number;
  readonly tick: number;
}

const W = 192;
const H = 128;
// Karl Sims' stable discretization: 9-point Laplacian, dt = 1
const DU = 1.0;
const DV = 0.5;
const ADJ = 0.2;
const DIAG = 0.05;

const DARK: [number, number, number] = [8, 10, 16];
const TEAL: [number, number, number] = [32, 160, 170];
const WHITE: [number, number, number] = [240, 250, 255];

function seedSquare(v: Float32Array, cx: number, cy: number, r: number): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const wx = ((x % W) + W) % W;
      const wy = ((y % H) + H) % H;
      v[wy * W + wx] = 1;
    }
  }
}

function laplacian(f: Float32Array, x: number, y: number): number {
  const xm = x === 0 ? W - 1 : x - 1;
  const xp = x === W - 1 ? 0 : x + 1;
  const ym = y === 0 ? H - 1 : y - 1;
  const yp = y === H - 1 ? 0 : y + 1;
  return (
    -f[y * W + x] +
    ADJ * (f[y * W + xm] + f[y * W + xp] + f[ym * W + x] + f[yp * W + x]) +
    DIAG * (f[ym * W + xm] + f[ym * W + xp] + f[yp * W + xm] + f[yp * W + xp])
  );
}

export const grayScott: Simulation<GrayScottState> = {
  id: "gray-scott",
  name: "Turing Patterns",
  blurb: "Chemistry inventing leopard spots",
  description:
    "Two chemicals diffuse and react: V eats U and reproduces, U is fed in, V decays " +
    "away. Turing's 1952 insight: diffusion — normally the great equalizer — can " +
    "destabilize a uniform mixture into spots, stripes, and labyrinths. The same math " +
    "patterns animal coats and fingerprints. Two numbers, feed and kill, pick the species.",
  whatToTry:
    "Defaults grow coral. Try feed 0.037 / kill 0.065 for mitosis — cells that " +
    "divide endlessly. Feed 0.014 / kill 0.045 melts everything into traveling waves. " +
    "Draw with the mouse to inject new growth.",
  params: [
    { key: "feed", label: "Feed F", min: 0.01, max: 0.09, step: 0.0005, default: 0.0545 },
    { key: "kill", label: "Kill k", min: 0.03, max: 0.075, step: 0.0005, default: 0.062 },
    { key: "seeds", label: "Seed sites", min: 0, max: 20, step: 1, default: 6, reinit: true },
  ],
  series: [{ key: "coverage", label: "Pattern coverage %", color: "#20a0aa" }],
  maxStepsPerFrame: 32,

  init(seed: number, p: Params): GrayScottState {
    const rng = new Rng(seed);
    const u = makeGridOf(W, H, Float32Array);
    const v = makeGridOf(W, H, Float32Array);
    u.cells.fill(1);
    for (let i = 0; i < p.seeds; i++) {
      seedSquare(v.cells, rng.int(W), rng.int(H), 2 + rng.int(3));
    }
    return { u, v, rngState: rng.state(), tick: 0 };
  },

  step(s: GrayScottState, p: Params): GrayScottState {
    const u = s.u.cells;
    const v = s.v.cells;
    const nu = new Float32Array(u.length);
    const nv = new Float32Array(v.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const uvv = u[i] * v[i] * v[i];
        nu[i] = u[i] + DU * laplacian(u, x, y) - uvv + p.feed * (1 - u[i]);
        nv[i] = v[i] + DV * laplacian(v, x, y) + uvv - (p.feed + p.kill) * v[i];
      }
    }
    return {
      u: { w: W, h: H, cells: nu },
      v: { w: W, h: H, cells: nv },
      rngState: s.rngState,
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    const v = s.v.cells;
    paintGrid(ctx, view, s.v, "gray-scott", (_, i) => {
      const k = Math.min(1, v[i] * 2.2);
      return k < 0.5 ? lerpRgb(DARK, TEAL, k * 2) : lerpRgb(TEAL, WHITE, (k - 0.5) * 2);
    });
  },

  stats(s) {
    let active = 0;
    for (let i = 0; i < s.v.cells.length; i++) {
      if (s.v.cells[i] > 0.1) active++;
    }
    return {
      tick: s.tick,
      coverage: (100 * active) / s.v.cells.length,
    };
  },

  onPointer(s, x, y, _buttons) {
    const next = s.v.cells.slice();
    seedSquare(next, Math.floor(x * W), Math.floor(y * H), 2);
    return { ...s, v: { w: W, h: H, cells: next } };
  },
};

export const GRAY_SCOTT_WORLD = { w: W, h: H };
