import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb, rgb } from "../ui/painter.js";

export interface RippleState {
  readonly u: Float32Array;
  readonly uPrev: Float32Array;
  readonly barrier: Uint8Array;
  readonly rngState: number;
  readonly tick: number;
}

const W = 260;
const H = 170;
const C2 = 0.18; // (c·dt/dx)^2, well under the 2D CFL limit
const BARRIER_X = Math.floor(W * 0.34);
const SPONGE = 18;

const NEG: [number, number, number] = [70, 150, 255];
const ZERO: [number, number, number] = [9, 12, 18];
const POS: [number, number, number] = [255, 120, 90];
const C_WALL = rgb(70, 78, 92);
// render scratch grid, allocated once; the color closure reads `u`, not cells
const RENDER_GRID = { w: W, h: H, cells: new Int16Array(W * H) };

function buildBarrier(slits: number, gap: number, width: number): Uint8Array {
  const b = new Uint8Array(W * H);
  if (slits === 0) return b;
  for (let y = 0; y < H; y++) b[y * W + BARRIER_X] = 1;
  // carve `slits` openings symmetric about the center
  const centers: number[] = [];
  if (slits === 1) centers.push(H / 2);
  else {
    const span = gap * (slits - 1);
    for (let k = 0; k < slits; k++) centers.push(H / 2 - span / 2 + k * gap);
  }
  for (const c of centers) {
    for (let dy = -width; dy <= width; dy++) {
      const y = Math.round(c + dy);
      if (y >= 0 && y < H) b[y * W + BARRIER_X] = 0;
    }
  }
  return b;
}

export const ripple: Simulation<RippleState> = {
  id: "ripple",
  name: "Wave Interference",
  blurb: "The double slit, from a local rule",
  description:
    "A field where each cell just nudges toward the average of its neighbors a beat " +
    "later — the discrete wave equation, the same rule for water, sound, and light. A " +
    "plane wave rolls in from the left and passes through slits in a wall. On the far " +
    "side the wavelets from each slit add and cancel, painting the interference fringes " +
    "of the double-slit experiment. The global pattern is nowhere in the rule; it is " +
    "the sum of countless local nudges.",
  whatToTry:
    "Switch between one, two, and three slits and watch the fringes appear and " +
    "rearrange. One slit just spreads (diffraction); two paint the famous bands. " +
    "Change the wavelength (frequency) and the bands fan wider or tighter. Click " +
    "anywhere to drop a stone and send out rings.",
  params: [
    { key: "slits", label: "Slits", min: 0, max: 3, step: 1, default: 2, reinit: true },
    { key: "frequency", label: "Frequency", min: 0.05, max: 0.4, step: 0.01, default: 0.18 },
    { key: "slitGap", label: "Slit spacing", min: 14, max: 60, step: 2, default: 34, reinit: true },
    { key: "damping", label: "Damping", min: 0, max: 0.01, step: 0.0005, default: 0.001 },
  ],
  series: [{ key: "intensity", label: "Far-field intensity", color: "#7ad7ff" }],
  maxStepsPerFrame: 4,

  init(seed: number, p: Params): RippleState {
    return {
      u: new Float32Array(W * H),
      uPrev: new Float32Array(W * H),
      barrier: buildBarrier(p.slits, p.slitGap, 2),
      rngState: new Rng(seed).state(),
      tick: 0,
    };
  },

  step(s: RippleState, p: Params): RippleState {
    const { u, uPrev, barrier } = s;
    const next = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (barrier[i]) continue;
        const lap = u[i - 1] + u[i + 1] + u[i - W] + u[i + W] - 4 * u[i];
        // sponge layer on the top, bottom, and right absorbs outgoing waves to
        // cut reflections; the left edge is the driven source, so no sponge there
        const edge = Math.min(W - 1 - x, y, H - 1 - y);
        const damp = p.damping + (edge < SPONGE ? (SPONGE - edge) * 0.012 : 0);
        let v = 2 * u[i] - uPrev[i] + C2 * lap;
        v *= 1 - damp;
        next[i] = v;
      }
    }

    // plane-wave source: a column on the left oscillates in phase
    const amp = Math.sin(p.frequency * (s.tick + 1));
    const sx = 3;
    for (let y = SPONGE; y < H - SPONGE; y++) {
      if (!barrier[y * W + sx]) next[y * W + sx] = amp;
    }

    return {
      u: next,
      uPrev: u,
      barrier,
      rngState: s.rngState,
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    const u = s.u;
    const barrier = s.barrier;
    paintGrid(ctx, view, RENDER_GRID, "ripple", (_v, i) => {
      if (barrier[i]) return C_WALL;
      const a = u[i];
      const t = Math.max(-1, Math.min(1, a * 1.4));
      return t >= 0 ? lerpRgb(ZERO, POS, t) : lerpRgb(ZERO, NEG, -t);
    });
  },

  stats(s) {
    // far-field intensity: mean squared amplitude in a band past the barrier
    let sumSq = 0;
    let count = 0;
    for (let y = SPONGE; y < H - SPONGE; y++) {
      for (let x = W - 60; x < W - SPONGE; x++) {
        sumSq += s.u[y * W + x] ** 2;
        count++;
      }
    }
    return {
      tick: s.tick,
      intensity: count > 0 ? sumSq / count : 0,
    };
  },

  onPointer(s, x, y, _buttons) {
    const cx = Math.floor(x * W);
    const cy = Math.floor(y * H);
    const u = s.u.slice();
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < 1 || px >= W - 1 || py < 1 || py >= H - 1) continue;
        if (dx * dx + dy * dy <= 9 && !s.barrier[py * W + px]) u[py * W + px] = 1.5;
      }
    }
    return { ...s, u };
  },
};

export const RIPPLE_WORLD = { w: W, h: H };
export { buildBarrier as rippleBarrier };
