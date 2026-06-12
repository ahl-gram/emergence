import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { clear } from "../ui/painter.js";

export interface Firefly {
  readonly x: number;
  readonly y: number;
  /** Oscillator phase in [0, 1); flashes on wrap. */
  readonly phase: number;
  /** Natural frequency multiplier (heterogeneity). */
  readonly rate: number;
}

export interface FirefliesState {
  readonly flies: ReadonlyArray<Firefly>;
  readonly rngState: number;
  readonly tick: number;
  readonly lastFlashes: number;
}

const W = 960;
const H = 640;
const DT = 0.012;
const FLASH_WINDOW = 0.05;

export const fireflies: Simulation<FirefliesState> = {
  id: "fireflies",
  name: "Fireflies",
  blurb: "Thousands of clocks agreeing to tick",
  description:
    "Each firefly blinks on its own internal clock — and seeing a neighbor flash " +
    "nudges its clock slightly forward. From random phases, pockets of agreement " +
    "form, merge, and suddenly the whole field pulses as one. Real riverbank " +
    "fireflies in Southeast Asia do exactly this. The chart shows sync order: " +
    "0 is incoherent twinkling, 1 is a single heartbeat.",
  whatToTry:
    "Set nudge to 0 — no amount of waiting produces sync. The tiniest nonzero " +
    "nudge eventually wins. Then add clock spread and find how much diversity " +
    "the consensus can absorb before it falls apart.",
  params: [
    { key: "count", label: "Fireflies", min: 50, max: 800, step: 25, default: 300, reinit: true },
    { key: "radius", label: "Sight radius", min: 30, max: 600, step: 10, default: 180 },
    { key: "nudge", label: "Nudge", min: 0, max: 0.3, step: 0.005, default: 0.06 },
    { key: "spread", label: "Clock spread", min: 0, max: 0.3, step: 0.01, default: 0.04 },
  ],
  series: [{ key: "sync", label: "Sync order", color: "#ffd966" }],
  maxStepsPerFrame: 32,

  init(seed: number, p: Params): FirefliesState {
    const rng = new Rng(seed);
    const flies: Firefly[] = Array.from({ length: p.count }, () => ({
      x: rng.range(0, W),
      y: rng.range(0, H),
      phase: rng.next(),
      rate: 1 + rng.range(-p.spread, p.spread),
    }));
    return { flies, rngState: rng.state(), tick: 0, lastFlashes: 0 };
  },

  step(s: FirefliesState, p: Params): FirefliesState {
    const advanced = s.flies.map((f) => ({ ...f, phase: f.phase + f.rate * DT }));

    const flashers: Firefly[] = [];
    const ticked = advanced.map((f) => {
      if (f.phase >= 1) {
        const reset = { ...f, phase: f.phase - 1 };
        flashers.push(reset);
        return reset;
      }
      return f;
    });

    const r2 = p.radius * p.radius;
    const flies = ticked.map((f) => {
      if (f.phase < FLASH_WINDOW) return f; // just flashed; refractory
      let nudges = 0;
      for (const flash of flashers) {
        const dx = f.x - flash.x;
        const dy = f.y - flash.y;
        if (f !== flash && dx * dx + dy * dy < r2) nudges++;
      }
      if (nudges === 0) return f;
      return { ...f, phase: Math.min(0.999, f.phase + nudges * p.nudge * f.phase) };
    });

    return {
      flies,
      rngState: s.rngState,
      tick: s.tick + 1,
      lastFlashes: flashers.length,
    };
  },

  render(s, ctx, view) {
    clear(ctx, view, "#07090d");
    const kx = view.width / W;
    const ky = view.height / H;
    for (const f of s.flies) {
      const flashing = f.phase < FLASH_WINDOW;
      if (flashing) {
        ctx.fillStyle = "rgba(255, 217, 102, 0.25)";
        ctx.beginPath();
        ctx.arc(f.x * kx, f.y * ky, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffe9a8";
      } else {
        const warmth = Math.floor(40 + f.phase * 50);
        ctx.fillStyle = `rgb(${warmth}, ${warmth}, ${Math.floor(warmth * 0.7)})`;
      }
      ctx.fillRect(f.x * kx - 1.5, f.y * ky - 1.5, 3, 3);
    }
  },

  stats(s) {
    let re = 0;
    let im = 0;
    for (const f of s.flies) {
      re += Math.cos(f.phase * 2 * Math.PI);
      im += Math.sin(f.phase * 2 * Math.PI);
    }
    const n = Math.max(1, s.flies.length);
    return {
      tick: s.tick,
      sync: Math.hypot(re, im) / n,
      flashing: s.lastFlashes,
    };
  },
};

export const FIREFLIES_WORLD = { w: W, h: H };
