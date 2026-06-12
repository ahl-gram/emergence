import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb, rgb } from "../ui/painter.js";

export interface FluidState {
  /** D2Q9 distributions, length 9 * W * H, laid out per-direction. */
  readonly f: Float32Array;
  readonly rngState: number;
  readonly tick: number;
}

const W = 260;
const H = 96;
const Q = 9;
// directions: rest, E, N, W, S, NE, NW, SW, SE
const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const WT = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];

const CYL_X = 64;
const CYL_Y = 43; // off the centerline (H/2 = 48) so the symmetric steady
                  // state doesn't exist and vortices shed on their own
const CYL_R = 11;

const POS: [number, number, number] = [255, 100, 80];
const NEG: [number, number, number] = [90, 170, 255];
const MID: [number, number, number] = [12, 16, 24];

// render scratch buffers, allocated once (reused every frame to avoid GC churn)
const RENDER_UX = new Float32Array(W * H);
const RENDER_UY = new Float32Array(W * H);
const RENDER_GRID = { w: W, h: H, cells: new Int16Array(W * H) };

function isObstacle(x: number, y: number): boolean {
  const dx = x - CYL_X;
  const dy = y - CYL_Y;
  return dx * dx + dy * dy <= CYL_R * CYL_R;
}

function equilibrium(out: Float32Array, base: number, rho: number, ux: number, uy: number): void {
  const usq = 1.5 * (ux * ux + uy * uy);
  for (let i = 0; i < Q; i++) {
    const eu = 3 * (EX[i] * ux + EY[i] * uy);
    out[base + i] = WT[i] * rho * (1 + eu + 0.5 * eu * eu - usq);
  }
}

export const fluid: Simulation<FluidState> = {
  id: "fluid",
  name: "Vortex Street",
  blurb: "Turbulence from collide-and-stream",
  description:
    "A fluid simulated the lattice-Boltzmann way: each cell holds nine numbers — how " +
    "much fluid is drifting in each direction — and does only two things per tick. " +
    "Collide (relax toward local equilibrium) and stream (hand each number to the " +
    "neighbor it points at). No Navier–Stokes solved anywhere, yet steady flow past " +
    "the cylinder destabilizes into the von Kármán vortex street: alternating spinning " +
    "eddies peeling off either side, the same wake that sings in telephone wires.",
  whatToTry:
    "Color is vorticity — red spins one way, blue the other. Raise the inflow speed " +
    "to tighten the eddies into turbulence; drop it and the wake goes smooth and " +
    "symmetric. The shedding is not programmed; it is the flow losing its balance.",
  params: [
    { key: "speed", label: "Inflow speed", min: 0.04, max: 0.16, step: 0.005, default: 0.11, reinit: true },
    { key: "viscosity", label: "Viscosity", min: 0.005, max: 0.05, step: 0.001, default: 0.01 },
  ],
  series: [{ key: "wakeSwing", label: "Wake asymmetry", color: "#ff785a" }],
  maxStepsPerFrame: 16,

  init(seed: number, p: Params): FluidState {
    const rng = new Rng(seed);
    const f = new Float32Array(Q * W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const base = (y * W + x) * Q;
        // vertical perturbation breaks the symmetry so shedding starts sooner
        const uy = rng.range(-0.01, 0.01);
        equilibrium(f, base, 1, p.speed, uy);
      }
    }
    return { f, rngState: rng.state(), tick: 0 };
  },

  step(s: FluidState, p: Params): FluidState {
    const tau = 3 * p.viscosity + 0.5;
    const invTau = 1 / tau;
    const f = s.f;
    const post = new Float32Array(f.length);
    const eq = new Float32Array(Q);

    // collide
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cell = y * W + x;
        const base = cell * Q;
        if (isObstacle(x, y)) {
          for (let i = 0; i < Q; i++) post[base + i] = f[base + OPP[i]]; // bounce-back
          continue;
        }
        let rho = 0;
        let ux = 0;
        let uy = 0;
        for (let i = 0; i < Q; i++) {
          const fi = f[base + i];
          rho += fi;
          ux += EX[i] * fi;
          uy += EY[i] * fi;
        }
        if (rho > 0) { ux /= rho; uy /= rho; }
        equilibrium(eq, 0, rho, ux, uy);
        for (let i = 0; i < Q; i++) {
          post[base + i] = f[base + i] + invTau * (eq[i] - f[base + i]);
        }
      }
    }

    // stream on a torus (wrap both axes — each value goes exactly one place,
    // so mass is conserved; the inflow/outflow columns are overwritten below)
    const next = new Float32Array(f.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const base = (y * W + x) * Q;
        for (let i = 0; i < Q; i++) {
          const nx = (x + EX[i] + W) % W;
          const ny = (y + EY[i] + H) % H;
          next[(ny * W + nx) * Q + i] = post[base + i];
        }
      }
    }

    // inflow on the left, free outflow on the right
    for (let y = 0; y < H; y++) {
      equilibrium(next, (y * W + 0) * Q, 1, p.speed, 0);
      const last = (y * W + (W - 1)) * Q;
      const prev = (y * W + (W - 2)) * Q;
      for (let i = 0; i < Q; i++) next[last + i] = next[prev + i];
    }

    return { f: next, rngState: s.rngState, tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    const f = s.f;
    const ux = RENDER_UX;
    const uy = RENDER_UY;
    for (let cell = 0; cell < W * H; cell++) {
      const base = cell * Q;
      let rho = 0;
      let x = 0;
      let y = 0;
      for (let i = 0; i < Q; i++) {
        const fi = f[base + i];
        rho += fi;
        x += EX[i] * fi;
        y += EY[i] * fi;
      }
      ux[cell] = rho > 0 ? x / rho : 0;
      uy[cell] = rho > 0 ? y / rho : 0;
    }

    paintGrid(ctx, view, RENDER_GRID, "fluid", (_v, cell) => {
      const x = cell % W;
      const y = (cell - x) / W;
      if (isObstacle(x, y)) return rgb(40, 44, 54);
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) return rgb(MID[0], MID[1], MID[2]);
      const curl =
        (uy[cell + 1] - uy[cell - 1]) - (ux[cell + W] - ux[cell - W]);
      const t = Math.max(-1, Math.min(1, curl * 18));
      return t >= 0 ? lerpRgb(MID, POS, t) : lerpRgb(MID, NEG, -t);
    });
  },

  stats(s) {
    const f = s.f;
    // wake asymmetry: net transverse velocity just behind the cylinder
    let swing = 0;
    let count = 0;
    const x = CYL_X + CYL_R + 6;
    for (let y = 10; y < H - 10; y++) {
      const base = (y * W + x) * Q;
      let rho = 0;
      let uy = 0;
      for (let i = 0; i < Q; i++) {
        rho += f[base + i];
        uy += EY[i] * f[base + i];
      }
      if (rho > 0) swing += uy / rho;
      count++;
    }
    return {
      tick: s.tick,
      wakeSwing: count > 0 ? swing / count : 0,
    };
  },
};

export const FLUID_WORLD = { w: W, h: H };
export { isObstacle as fluidIsObstacle };
