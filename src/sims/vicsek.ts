import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { clear } from "../ui/painter.js";

export interface VicsekState {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly angle: Float32Array;
  readonly rngState: number;
  readonly tick: number;
}

const W = 600;
const H = 400;
const SPEED = 2.4;

/**
 * Spatial hash so each particle only checks nearby cells, not all N.
 * Cell size = interaction radius; neighbors live in the 3x3 block.
 */
function buildBins(x: Float32Array, y: Float32Array, r: number) {
  const cols = Math.max(1, Math.floor(W / r));
  const rows = Math.max(1, Math.floor(H / r));
  const bins: number[][] = Array.from({ length: cols * rows }, () => []);
  const cellOf = (px: number, py: number) => {
    const cx = Math.min(cols - 1, Math.floor((px / W) * cols));
    const cy = Math.min(rows - 1, Math.floor((py / H) * rows));
    return cy * cols + cx;
  };
  for (let i = 0; i < x.length; i++) bins[cellOf(x[i], y[i])].push(i);
  return { bins, cols, rows };
}

export const vicsek: Simulation<VicsekState> = {
  id: "vicsek",
  name: "Active Matter",
  blurb: "A flocking phase transition",
  description:
    "Self-propelled particles, each steering toward the average heading of its " +
    "neighbors plus a little noise. Below a critical noise the swarm spontaneously " +
    "picks a direction and moves as one; above it, the order shatters into a " +
    "directionless gas. This is the Vicsek model — the simplest system that shows " +
    "flocking is a genuine phase transition, like water freezing.",
  whatToTry:
    "Drag noise down toward 0.1 and watch a single coherent flock crystallize out " +
    "of chaos; push it past 0.6 and the order melts. Lower the density and the " +
    "critical noise drops with it — sparse crowds agree less easily.",
  params: [
    { key: "count", label: "Particles", min: 100, max: 2500, step: 100, default: 1000, reinit: true },
    { key: "noise", label: "Noise", min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: "radius", label: "Sight radius", min: 10, max: 60, step: 1, default: 24 },
  ],
  series: [{ key: "order", label: "Flocking order", color: "#7ad7ff" }],
  maxStepsPerFrame: 8,

  init(seed: number, p: Params): VicsekState {
    const rng = new Rng(seed);
    const n = p.count;
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const angle = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = rng.range(0, W);
      y[i] = rng.range(0, H);
      angle[i] = rng.range(0, Math.PI * 2);
    }
    return { x, y, angle, rngState: rng.state(), tick: 0 };
  },

  step(s: VicsekState, p: Params): VicsekState {
    const rng = Rng.fromState(s.rngState);
    const n = s.x.length;
    const { bins, cols, rows } = buildBins(s.x, s.y, p.radius);
    const r2 = p.radius * p.radius;
    const nx = new Float32Array(n);
    const ny = new Float32Array(n);
    const nAngle = new Float32Array(n);

    const cellX = (px: number) => Math.min(cols - 1, Math.floor((px / W) * cols));
    const cellY = (py: number) => Math.min(rows - 1, Math.floor((py / H) * rows));

    for (let i = 0; i < n; i++) {
      let sumSin = Math.sin(s.angle[i]);
      let sumCos = Math.cos(s.angle[i]);
      const cx = cellX(s.x[i]);
      const cy = cellY(s.y[i]);
      for (let gy = -1; gy <= 1; gy++) {
        const by = cy + gy;
        if (by < 0 || by >= rows) continue;
        for (let gx = -1; gx <= 1; gx++) {
          const bx = cx + gx;
          if (bx < 0 || bx >= cols) continue;
          for (const j of bins[by * cols + bx]) {
            if (j === i) continue;
            const dx = s.x[j] - s.x[i];
            const dy = s.y[j] - s.y[i];
            if (dx * dx + dy * dy < r2) {
              sumSin += Math.sin(s.angle[j]);
              sumCos += Math.cos(s.angle[j]);
            }
          }
        }
      }
      const mean = Math.atan2(sumSin, sumCos);
      const a = mean + rng.range(-Math.PI, Math.PI) * p.noise;
      nAngle[i] = a;
      nx[i] = (s.x[i] + Math.cos(a) * SPEED + W) % W;
      ny[i] = (s.y[i] + Math.sin(a) * SPEED + H) % H;
    }

    return { x: nx, y: ny, angle: nAngle, rngState: rng.state(), tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    clear(ctx, view, "#080a0e");
    const kx = view.width / W;
    const ky = view.height / H;
    const n = s.x.length;
    for (let i = 0; i < n; i++) {
      const hue = ((s.angle[i] / (Math.PI * 2)) * 360 + 360) % 360;
      ctx.fillStyle = `hsl(${hue}, 80%, 65%)`;
      const px = s.x[i] * kx;
      const py = s.y[i] * ky;
      const a = s.angle[i];
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a) * 4, py + Math.sin(a) * 4);
      ctx.lineTo(px + Math.cos(a + 2.5) * 3, py + Math.sin(a + 2.5) * 3);
      ctx.lineTo(px + Math.cos(a - 2.5) * 3, py + Math.sin(a - 2.5) * 3);
      ctx.closePath();
      ctx.fill();
    }
  },

  stats(s) {
    let sumSin = 0;
    let sumCos = 0;
    const n = s.x.length;
    for (let i = 0; i < n; i++) {
      sumSin += Math.sin(s.angle[i]);
      sumCos += Math.cos(s.angle[i]);
    }
    return {
      tick: s.tick,
      order: Math.hypot(sumSin, sumCos) / n,
    };
  },
};

export const VICSEK_WORLD = { w: W, h: H };
