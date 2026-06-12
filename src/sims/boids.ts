import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";

export interface Boid {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

export interface BoidsState {
  readonly boids: ReadonlyArray<Boid>;
  readonly rngState: number;
  readonly tick: number;
}

const W = 960;
const H = 640;
const FORCE = 0.2;
const JITTER = 0.05;

function wrapDelta(d: number, m: number): number {
  return d - m * Math.round(d / m);
}

function wrapPos(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function norm(x: number, y: number): [number, number] {
  const len = Math.hypot(x, y);
  return len > 1e-9 ? [x / len, y / len] : [0, 0];
}

export const boids: Simulation<BoidsState> = {
  id: "boids",
  name: "Boids",
  blurb: "Flocking from three steering rules",
  description:
    "Each bird steers by three local urges: don't crowd neighbors (separation), " +
    "match their heading (alignment), and drift toward their center (cohesion). " +
    "No leader, no plan — yet the group moves as one organism. The chart tracks " +
    "polarization: how aligned the whole flock is, from 0 (chaos) to 1 (one heading).",
  whatToTry:
    "Zero out alignment and watch polarization collapse while clumps still form. " +
    "Then max separation for a gas of loners. Order is a knife-edge between the two.",
  params: [
    { key: "count", label: "Birds", min: 10, max: 600, step: 10, default: 220, reinit: true },
    { key: "radius", label: "Perception", min: 10, max: 120, step: 1, default: 55 },
    { key: "separation", label: "Separation", min: 0, max: 3, step: 0.1, default: 1.2 },
    { key: "alignment", label: "Alignment", min: 0, max: 3, step: 0.1, default: 1.0 },
    { key: "cohesion", label: "Cohesion", min: 0, max: 3, step: 0.1, default: 0.8 },
    { key: "maxSpeed", label: "Max speed", min: 1, max: 6, step: 0.1, default: 3.2 },
  ],
  series: [{ key: "polarization", label: "Polarization", color: "#7ad7ff" }],
  maxStepsPerFrame: 8,

  init(seed: number, p: Params): BoidsState {
    const rng = new Rng(seed);
    const list: Boid[] = [];
    for (let i = 0; i < p.count; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const speed = p.maxSpeed * 0.7;
      list.push({
        x: rng.range(0, W),
        y: rng.range(0, H),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }
    return { boids: list, rngState: rng.state(), tick: 0 };
  },

  step(s: BoidsState, p: Params): BoidsState {
    const rng = Rng.fromState(s.rngState);
    const r2 = p.radius * p.radius;
    const sepR2 = r2 * 0.45 * 0.45;
    const minSpeed = p.maxSpeed * 0.45;
    const prev = s.boids;

    const next = prev.map((b) => {
      let count = 0;
      let sumVx = 0, sumVy = 0;
      let sumDx = 0, sumDy = 0;
      let sepX = 0, sepY = 0;

      for (const o of prev) {
        if (o === b) continue;
        const dx = wrapDelta(o.x - b.x, W);
        const dy = wrapDelta(o.y - b.y, H);
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2) continue;
        count++;
        sumVx += o.vx;
        sumVy += o.vy;
        sumDx += dx;
        sumDy += dy;
        if (d2 < sepR2 && d2 > 1e-9) {
          sepX -= dx / d2;
          sepY -= dy / d2;
        }
      }

      let ax = rng.range(-JITTER, JITTER);
      let ay = rng.range(-JITTER, JITTER);
      const [sx, sy] = norm(sepX, sepY);
      ax += sx * p.separation * FORCE;
      ay += sy * p.separation * FORCE;
      if (count > 0) {
        const [alx, aly] = norm(sumVx / count - b.vx, sumVy / count - b.vy);
        ax += alx * p.alignment * FORCE;
        ay += aly * p.alignment * FORCE;
        const [cx, cy] = norm(sumDx / count, sumDy / count);
        ax += cx * p.cohesion * FORCE;
        ay += cy * p.cohesion * FORCE;
      }

      let vx = b.vx + ax;
      let vy = b.vy + ay;
      const speed = Math.hypot(vx, vy);
      const clamped = Math.min(p.maxSpeed, Math.max(minSpeed, speed));
      if (speed > 1e-9) {
        vx = (vx / speed) * clamped;
        vy = (vy / speed) * clamped;
      } else {
        vx = clamped;
        vy = 0;
      }
      return { x: wrapPos(b.x + vx, W), y: wrapPos(b.y + vy, H), vx, vy };
    });

    return { boids: next, rngState: rng.state(), tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    ctx.fillStyle = "rgba(11, 14, 20, 0.35)";
    ctx.fillRect(0, 0, view.width, view.height);
    const kx = view.width / W;
    const ky = view.height / H;
    ctx.fillStyle = "#7ad7ff";
    for (const b of s.boids) {
      const angle = Math.atan2(b.vy, b.vx);
      const x = b.x * kx;
      const y = b.y * ky;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, 3);
      ctx.lineTo(-4, -3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  stats(s) {
    let ux = 0, uy = 0, speedSum = 0;
    for (const b of s.boids) {
      const speed = Math.hypot(b.vx, b.vy);
      speedSum += speed;
      if (speed > 1e-9) {
        ux += b.vx / speed;
        uy += b.vy / speed;
      }
    }
    const n = Math.max(1, s.boids.length);
    return {
      tick: s.tick,
      birds: s.boids.length,
      polarization: Math.hypot(ux, uy) / n,
      avgSpeed: speedSum / n,
    };
  },
};

export const BOIDS_WORLD = { w: W, h: H };
