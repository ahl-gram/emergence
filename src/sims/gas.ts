import { Rng } from "../core/rng.js";
import type { Simulation, Params } from "../core/types.js";
import { clear } from "../ui/painter.js";

export interface GasState {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly rngState: number;
  readonly tick: number;
}

const W = 600;
const H = 440;
const RADIUS = 5;
const START_SPEED = 3;

export const gas: Simulation<GasState> = {
  id: "gas",
  name: "Maxwell–Boltzmann Gas",
  blurb: "Temperature emerging from billiards",
  description:
    "Every disk starts with exactly the same speed — a wall of identical billiard " +
    "balls. They only ever collide elastically, conserving energy and momentum, with " +
    "no friction and no randomness in the physics. Yet within seconds the single " +
    "starting speed spreads into the bell-shaped Maxwell–Boltzmann distribution " +
    "(its 2D form, the Rayleigh curve, drawn in white). 'Temperature' is not put in; " +
    "it falls out of deterministic collisions. This is statistical mechanics in a box.",
  whatToTry:
    "Watch the histogram bloom from a single spike into the smooth curve and then " +
    "stay there — equilibrium is a shape, not a state of rest. The white overlay is " +
    "theory with no fitting; total energy (the title bar) holds constant throughout.",
  params: [
    { key: "count", label: "Particles", min: 50, max: 500, step: 10, default: 260, reinit: true },
  ],
  series: [{ key: "speedSpread", label: "Speed spread (std dev)", color: "#ff9d3d" }],
  maxStepsPerFrame: 4,

  init(seed: number, p: Params): GasState {
    const rng = new Rng(seed);
    const n = p.count;
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const vx = new Float32Array(n);
    const vy = new Float32Array(n);
    // place on a jittered grid so nothing starts overlapping
    const cols = Math.ceil(Math.sqrt((n * W) / H));
    const rows = Math.ceil(n / cols);
    const cellW = W / cols;
    const cellH = H / rows;
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      x[i] = cellW * (c + 0.5) + rng.range(-cellW * 0.2, cellW * 0.2);
      y[i] = cellH * (r + 0.5) + rng.range(-cellH * 0.2, cellH * 0.2);
      const a = rng.range(0, Math.PI * 2);
      vx[i] = Math.cos(a) * START_SPEED;
      vy[i] = Math.sin(a) * START_SPEED;
    }
    return { x, y, vx, vy, rngState: rng.state(), tick: 0 };
  },

  step(s: GasState, _p: Params): GasState {
    const n = s.x.length;
    const x = s.x.slice();
    const y = s.y.slice();
    const vx = s.vx.slice();
    const vy = s.vy.slice();

    for (let i = 0; i < n; i++) {
      x[i] += vx[i];
      y[i] += vy[i];
      if (x[i] < RADIUS && vx[i] < 0) { vx[i] = -vx[i]; x[i] = RADIUS; }
      else if (x[i] > W - RADIUS && vx[i] > 0) { vx[i] = -vx[i]; x[i] = W - RADIUS; }
      if (y[i] < RADIUS && vy[i] < 0) { vy[i] = -vy[i]; y[i] = RADIUS; }
      else if (y[i] > H - RADIUS && vy[i] > 0) { vy[i] = -vy[i]; y[i] = H - RADIUS; }
    }

    const d = 2 * RADIUS;
    const d2 = d * d;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = x[j] - x[i];
        const dy = y[j] - y[i];
        const dist2 = dx * dx + dy * dy;
        if (dist2 >= d2 || dist2 === 0) continue;
        const dist = Math.sqrt(dist2);
        const nx = dx / dist;
        const ny = dy / dist;
        const rel = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny;
        if (rel < 0) {
          // equal mass elastic: exchange the velocity component along the normal
          vx[i] += rel * nx;
          vy[i] += rel * ny;
          vx[j] -= rel * nx;
          vy[j] -= rel * ny;
        }
        // separate the overlap so pairs don't stick
        const overlap = (d - dist) / 2;
        x[i] -= nx * overlap;
        y[i] -= ny * overlap;
        x[j] += nx * overlap;
        y[j] += ny * overlap;
      }
    }

    return { x, y, vx, vy, rngState: s.rngState, tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    clear(ctx, view, "#0a0c10");
    const n = s.x.length;
    const kx = view.width / W;
    const ky = view.height / H;
    const r = RADIUS * Math.min(kx, ky);

    let maxSpeed = 1e-6;
    const speeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      speeds[i] = Math.hypot(s.vx[i], s.vy[i]);
      if (speeds[i] > maxSpeed) maxSpeed = speeds[i];
    }

    for (let i = 0; i < n; i++) {
      const t = Math.min(1, speeds[i] / (START_SPEED * 2.2));
      ctx.fillStyle = `rgb(${Math.floor(80 + 175 * t)}, ${Math.floor(180 - 80 * t)}, ${Math.floor(255 - 160 * t)})`;
      ctx.beginPath();
      ctx.arc(s.x[i] * kx, s.y[i] * ky, r, 0, Math.PI * 2);
      ctx.fill();
    }

    drawHistogram(ctx, view, speeds);
  },

  stats(s) {
    const n = s.x.length;
    let energy = 0;
    let speedSum = 0;
    const speeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const sp = Math.hypot(s.vx[i], s.vy[i]);
      speeds[i] = sp;
      speedSum += sp;
      energy += sp * sp;
    }
    const mean = speedSum / n;
    let varSum = 0;
    for (let i = 0; i < n; i++) varSum += (speeds[i] - mean) ** 2;
    return {
      tick: s.tick,
      energy: Math.round(energy),
      meanSpeed: mean,
      speedSpread: Math.sqrt(varSum / n),
    };
  },
};

const BINS = 36;

function drawHistogram(ctx: CanvasRenderingContext2D, view: { width: number; height: number }, speeds: Float32Array): void {
  const n = speeds.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += speeds[i] * speeds[i];
  // 2D equipartition: <v^2> = 2 sigma^2  =>  sigma^2 = energy / (2n)
  const sigma2 = energy / (2 * n);
  const vMax = START_SPEED * 2.6;
  const counts = new Float32Array(BINS);
  for (let i = 0; i < n; i++) {
    const b = Math.min(BINS - 1, Math.floor((speeds[i] / vMax) * BINS));
    counts[b]++;
  }
  let peak = 1;
  for (const c of counts) if (c > peak) peak = c;

  const hw = view.width * 0.34;
  const hh = view.height * 0.26;
  const ox = view.width - hw - 14;
  const oy = view.height - hh - 14;
  ctx.fillStyle = "rgba(8, 10, 16, 0.82)";
  ctx.fillRect(ox - 8, oy - 8, hw + 16, hh + 24);
  ctx.strokeStyle = "#232a3a";
  ctx.strokeRect(ox - 8, oy - 8, hw + 16, hh + 24);

  const bw = hw / BINS;
  ctx.fillStyle = "#7ad7ff";
  for (let b = 0; b < BINS; b++) {
    const h = (counts[b] / peak) * hh;
    ctx.fillRect(ox + b * bw, oy + hh - h, Math.max(1, bw - 1), h);
  }

  // Rayleigh (2D Maxwell speed distribution): both bars and curve are
  // normalized so their peaks reach hh, so the shapes overlay directly.
  const pdfAtMode = (1 / Math.sqrt(sigma2)) * Math.exp(-0.5); // mode v = sigma
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let px = 0; px <= BINS * 2; px++) {
    const v = (px / (BINS * 2)) * vMax;
    const pdf = (v / sigma2) * Math.exp(-(v * v) / (2 * sigma2));
    const h = Math.min(hh, (pdf / pdfAtMode) * hh);
    const x = ox + (px / (BINS * 2)) * hw;
    const yy = oy + hh - h;
    if (px === 0) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = "#7d8aa0";
  ctx.font = "11px ui-monospace, Menlo, monospace";
  ctx.fillText("speed distribution → Maxwell–Boltzmann (white)", ox, oy + hh + 13);
}
