import { Rng } from "../core/rng.js";
import { makeGridOf, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb, rgb } from "../ui/painter.js";

export interface PhysarumState {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly heading: Float32Array;
  readonly trail: Grid<Float32Array>;
  readonly rngState: number;
  readonly tick: number;
}

const W = 260;
const H = 180;
const DEPOSIT = 5;
const BG: [number, number, number] = [8, 10, 14];
const LOW: [number, number, number] = [40, 110, 90];
const MID: [number, number, number] = [120, 230, 170];
const HOT: [number, number, number] = [240, 255, 220];

function sample(trail: Float32Array, x: number, y: number): number {
  const ix = ((Math.floor(x) % W) + W) % W;
  const iy = ((Math.floor(y) % H) + H) % H;
  return trail[iy * W + ix];
}

export const physarum: Simulation<PhysarumState> = {
  id: "physarum",
  name: "Slime Mold",
  blurb: "Nature's road network, no engineer",
  description:
    "Thousands of mindless agents, each sniffing the trail just ahead and to its " +
    "sides, turning toward whatever smells strongest, and dribbling more trail as it " +
    "goes. The deposits diffuse and evaporate. From this single feedback loop the " +
    "colony weaves a living network of veins that reroutes and optimizes itself — the " +
    "real slime mold Physarum solves mazes and reproduces transit maps this way.",
  whatToTry:
    "Watch filaments braid into a transport web, then prune to efficient trunk lines. " +
    "Widen the sensor angle for a finer mesh; raise evaporation and the network can't " +
    "hold itself together. It is the ant-trail idea with no nest and no food — just " +
    "trail chasing trail.",
  params: [
    { key: "agents", label: "Agents", min: 500, max: 8000, step: 250, default: 3500, reinit: true },
    { key: "sensorAngle", label: "Sensor angle", min: 0.1, max: 1.4, step: 0.05, default: 0.5 },
    { key: "turn", label: "Turn speed", min: 0.1, max: 1.4, step: 0.05, default: 0.45 },
    { key: "sensorDist", label: "Sensor distance", min: 3, max: 24, step: 1, default: 9 },
    { key: "evaporation", label: "Evaporation", min: 0.005, max: 0.2, step: 0.005, default: 0.06 },
  ],
  series: [{ key: "coverage", label: "Network coverage %", color: "#7ee0aa" }],
  maxStepsPerFrame: 8,

  init(seed: number, p: Params): PhysarumState {
    const rng = new Rng(seed);
    const n = p.agents;
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const heading = new Float32Array(n);
    // spread agents across the whole dish; a central clump collapses to a
    // single blob instead of weaving a network (verified by parameter sweep)
    for (let i = 0; i < n; i++) {
      x[i] = rng.range(0, W);
      y[i] = rng.range(0, H);
      heading[i] = rng.range(0, Math.PI * 2);
    }
    return {
      x,
      y,
      heading,
      trail: makeGridOf(W, H, Float32Array),
      rngState: rng.state(),
      tick: 0,
    };
  },

  step(s: PhysarumState, p: Params): PhysarumState {
    const rng = Rng.fromState(s.rngState);
    const n = s.x.length;
    const prev = s.trail.cells;
    const nx = new Float32Array(n);
    const ny = new Float32Array(n);
    const nh = new Float32Array(n);
    const deposits = new Float32Array(prev.length);

    for (let i = 0; i < n; i++) {
      const h = s.heading[i];
      const fx = s.x[i] + Math.cos(h) * p.sensorDist;
      const fy = s.y[i] + Math.sin(h) * p.sensorDist;
      const lx = s.x[i] + Math.cos(h - p.sensorAngle) * p.sensorDist;
      const ly = s.y[i] + Math.sin(h - p.sensorAngle) * p.sensorDist;
      const rx = s.x[i] + Math.cos(h + p.sensorAngle) * p.sensorDist;
      const ry = s.y[i] + Math.sin(h + p.sensorAngle) * p.sensorDist;
      const cF = sample(prev, fx, fy);
      const cL = sample(prev, lx, ly);
      const cR = sample(prev, rx, ry);

      let nextH = h;
      if (cF >= cL && cF >= cR) {
        // keep heading
      } else if (cL > cR) {
        nextH = h - p.turn;
      } else if (cR > cL) {
        nextH = h + p.turn;
      } else {
        nextH = h + (rng.bool(0.5) ? p.turn : -p.turn);
      }

      const mx = (s.x[i] + Math.cos(nextH) + W) % W;
      const my = (s.y[i] + Math.sin(nextH) + H) % H;
      nx[i] = mx;
      ny[i] = my;
      nh[i] = nextH;
      deposits[(Math.floor(my) % H) * W + (Math.floor(mx) % W)] += DEPOSIT;
    }

    // diffuse (3x3 box blur) + evaporate
    const trail = new Float32Array(prev.length);
    const keep = 1 - p.evaporation;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = (y + dy + H) % H;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = (x + dx + W) % W;
            sum += prev[yy * W + xx];
          }
        }
        const i = y * W + x;
        trail[i] = (sum / 9 + deposits[i]) * keep;
      }
    }

    return { x: nx, y: ny, heading: nh, trail: { w: W, h: H, cells: trail }, rngState: rng.state(), tick: s.tick + 1 };
  },

  render(s, ctx, view) {
    paintGrid(ctx, view, s.trail, "physarum", (v) => {
      const t = Math.min(1, v / 12);
      if (t < 0.001) return rgb(BG[0], BG[1], BG[2]);
      return t < 0.5 ? lerpRgb(LOW, MID, t * 2) : lerpRgb(MID, HOT, (t - 0.5) * 2);
    });
  },

  stats(s) {
    let covered = 0;
    for (let i = 0; i < s.trail.cells.length; i++) {
      if (s.trail.cells[i] > 1) covered++;
    }
    return {
      tick: s.tick,
      agents: s.x.length,
      coverage: (100 * covered) / s.trail.cells.length,
    };
  },
};

export const PHYSARUM_WORLD = { w: W, h: H };
