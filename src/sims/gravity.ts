import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";

export interface Body {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

export interface GravityState {
  readonly bodies: ReadonlyArray<Body>;
  readonly rngState: number;
  readonly tick: number;
}

const W = 960;
const H = 640;
const CX = W / 2;
const CY = H / 2;
const DT = 0.5;

export const gravity: Simulation<GravityState> = {
  id: "gravity",
  name: "Gravity Clumps",
  blurb: "Structure from a featureless cloud",
  description:
    "Hundreds of specks, every one pulling on every other. A featureless spinning " +
    "cloud collapses into clumps, the clumps swallow each other, and survivors get " +
    "flung into wide orbits — galaxy formation in miniature. The same physics that " +
    "turned a smooth early universe into stars and voids: gravity amplifies any " +
    "tiny unevenness it can find.",
  whatToTry:
    "Set spin to 0 for a violent radial collapse and ejections; high spin settles " +
    "into an orbiting disk with a heavy core. Softening is the model's mercy — " +
    "lower it and close encounters turn into slingshots.",
  params: [
    { key: "bodies", label: "Bodies", min: 50, max: 800, step: 25, default: 350, reinit: true },
    { key: "G", label: "Gravity strength", min: 0.5, max: 8, step: 0.1, default: 3 },
    { key: "softening", label: "Softening", min: 2, max: 30, step: 1, default: 8 },
    { key: "spin", label: "Initial spin", min: 0, max: 1, step: 0.05, default: 0.55, reinit: true },
  ],
  series: [{ key: "clumping", label: "Clumping (near pairs)", color: "#ffd966" }],
  maxStepsPerFrame: 8,

  init(seed: number, p: Params): GravityState {
    const rng = new Rng(seed);
    const bodies: Body[] = [];
    const radius = 220;
    for (let i = 0; i < p.bodies; i++) {
      const r = radius * Math.sqrt(rng.next());
      const theta = rng.range(0, Math.PI * 2);
      const speed = p.spin * Math.sqrt(r) * 0.55;
      bodies.push({
        x: CX + r * Math.cos(theta),
        y: CY + r * Math.sin(theta),
        vx: -Math.sin(theta) * speed + rng.range(-0.2, 0.2),
        vy: Math.cos(theta) * speed + rng.range(-0.2, 0.2),
      });
    }
    // remove net drift so the cloud stays centered
    let mvx = 0;
    let mvy = 0;
    for (const b of bodies) {
      mvx += b.vx;
      mvy += b.vy;
    }
    mvx /= bodies.length;
    mvy /= bodies.length;
    return {
      bodies: bodies.map((b) => ({ ...b, vx: b.vx - mvx, vy: b.vy - mvy })),
      rngState: rng.state(),
      tick: 0,
    };
  },

  step(s: GravityState, p: Params): GravityState {
    const n = s.bodies.length;
    const ax = new Float64Array(n);
    const ay = new Float64Array(n);
    const soft2 = p.softening * p.softening;

    for (let i = 0; i < n; i++) {
      const bi = s.bodies[i];
      for (let j = i + 1; j < n; j++) {
        const bj = s.bodies[j];
        const dx = bj.x - bi.x;
        const dy = bj.y - bi.y;
        const d2 = dx * dx + dy * dy + soft2;
        const inv = p.G / (d2 * Math.sqrt(d2));
        ax[i] += dx * inv;
        ay[i] += dy * inv;
        ax[j] -= dx * inv;
        ay[j] -= dy * inv;
      }
    }

    const bodies = s.bodies.map((b, i) => {
      const vx = b.vx + ax[i] * DT;
      const vy = b.vy + ay[i] * DT;
      return { x: b.x + vx * DT, y: b.y + vy * DT, vx, vy };
    });

    return { bodies, rngState: s.rngState, tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    ctx.fillStyle = "rgba(7, 9, 13, 0.22)";
    ctx.fillRect(0, 0, view.width, view.height);
    const kx = view.width / W;
    const ky = view.height / H;
    for (const b of s.bodies) {
      const speed = Math.hypot(b.vx, b.vy);
      const warm = Math.min(1, speed / 6);
      ctx.fillStyle = `rgb(${Math.floor(150 + 105 * warm)}, ${Math.floor(190 - 60 * warm)}, ${Math.floor(255 - 140 * warm)})`;
      const x = b.x * kx;
      const y = b.y * ky;
      if (x >= 0 && x < view.width && y >= 0 && y < view.height) {
        ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
      }
    }
  },

  stats(s) {
    const n = s.bodies.length;
    let near = 0;
    let mvx = 0;
    let mvy = 0;
    for (let i = 0; i < n; i++) {
      mvx += s.bodies[i].vx;
      mvy += s.bodies[i].vy;
      for (let j = i + 1; j < n; j++) {
        const dx = s.bodies[j].x - s.bodies[i].x;
        const dy = s.bodies[j].y - s.bodies[i].y;
        if (dx * dx + dy * dy < 400) near++;
      }
    }
    return {
      step: s.tick,
      clumping: (2 * near) / n,
      momentumDrift: Math.hypot(mvx, mvy) / n,
    };
  },
};

export const GRAVITY_WORLD = { w: W, h: H };
