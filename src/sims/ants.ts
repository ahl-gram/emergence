import { Rng } from "../core/rng.js";
import { makeGrid, makeGridOf, type Grid } from "../core/grid.js";
import type { Simulation, Params } from "../core/types.js";
import { paintGrid, lerpRgb, rgb } from "../ui/painter.js";

export interface Ant {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly carrying: boolean;
  /** Steps since food pickup; deposits fade with trip length to form a gradient. */
  readonly trip: number;
}

export interface AntsState {
  readonly food: Grid<Uint8Array>;
  readonly pher: Grid<Float32Array>;
  readonly ants: ReadonlyArray<Ant>;
  readonly collected: number;
  readonly rngState: number;
  readonly tick: number;
}

export const ANTS_WORLD = { w: 192, h: 128 };
const W = ANTS_WORLD.w;
const H = ANTS_WORLD.h;
const NEST_X = W / 2;
const NEST_Y = H / 2;
const NEST_R = 3;
const SENSOR_DIST = 5;
const SENSOR_ANGLE = 0.6;
const FOOD_WEIGHT = 3;

const BG: [number, number, number] = [10, 12, 16];
const TRAIL: [number, number, number] = [64, 170, 220];
const C_NEST = rgb(255, 157, 61);

function inNest(x: number, y: number): boolean {
  const dx = x - NEST_X;
  const dy = y - NEST_Y;
  return dx * dx + dy * dy < NEST_R * NEST_R;
}

function cellOf(x: number, y: number): number {
  return Math.floor(y) * W + Math.floor(x);
}

function sense(pher: Float32Array, food: Uint8Array, x: number, y: number, angle: number): number {
  const sx = x + Math.cos(angle) * SENSOR_DIST;
  const sy = y + Math.sin(angle) * SENSOR_DIST;
  if (sx < 0 || sx >= W || sy < 0 || sy >= H) return -1;
  const i = cellOf(sx, sy);
  return pher[i] + food[i] * FOOD_WEIGHT;
}

function spawnAnt(rng: Rng): Ant {
  return {
    x: NEST_X,
    y: NEST_Y,
    angle: rng.range(0, Math.PI * 2),
    carrying: false,
    trip: 0,
  };
}

function dropFood(cells: Uint8Array, cx: number, cy: number, radius: number, amount: number): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      cells[y * W + x] = Math.min(5, cells[y * W + x] + amount);
    }
  }
}

export const ants: Simulation<AntsState> = {
  id: "ants",
  name: "Ant Foraging",
  blurb: "Trails written into the world",
  description:
    "Ants leave the nest knowing nothing. Finders carry food home, dripping pheromone " +
    "that fades with distance from the find; searchers steer toward the strongest scent " +
    "ahead. The colony's memory lives in the dirt, not in any ant — stigmergy. Trails " +
    "sharpen with traffic, evaporate when a source dries up, and reroute on their own.",
  whatToTry:
    "Click anywhere to drop new food and watch a trail discover it. Crank evaporation " +
    "and trails can't persist — the colony forgets faster than it can learn.",
  params: [
    { key: "ants", label: "Ants", min: 20, max: 800, step: 10, default: 250, reinit: true },
    { key: "blobs", label: "Food piles", min: 1, max: 12, step: 1, default: 5, reinit: true },
    { key: "evaporation", label: "Evaporation", min: 0.001, max: 0.1, step: 0.001, default: 0.015 },
    { key: "diffusion", label: "Diffusion", min: 0, max: 0.5, step: 0.01, default: 0.12 },
    { key: "wiggle", label: "Wander", min: 0, max: 1, step: 0.05, default: 0.35 },
  ],
  series: [
    { key: "collected", label: "Food collected", color: "#9ece6a" },
    { key: "carrying", label: "Carrying now", color: "#ff9d3d" },
  ],
  maxStepsPerFrame: 8,

  init(seed: number, p: Params): AntsState {
    const rng = new Rng(seed);
    const food = makeGrid(W, H);
    for (let b = 0; b < p.blobs; b++) {
      const margin = 14;
      let x = 0;
      let y = 0;
      do {
        x = rng.int(W - margin * 2) + margin;
        y = rng.int(H - margin * 2) + margin;
      } while (Math.hypot(x - NEST_X, y - NEST_Y) < 25);
      dropFood(food.cells, x, y, rng.int(3) + 3, 5);
    }
    return {
      food,
      pher: makeGridOf(W, H, Float32Array),
      ants: Array.from({ length: p.ants }, () => spawnAnt(rng)),
      collected: 0,
      rngState: rng.state(),
      tick: 0,
    };
  },

  step(s: AntsState, p: Params): AntsState {
    const rng = Rng.fromState(s.rngState);
    const food = s.food.cells.slice();
    const pherPrev = s.pher.cells;

    // evaporate + diffuse into a fresh buffer
    const pher = new Float32Array(pherPrev.length);
    const keep = 1 - p.evaporation;
    const d = p.diffusion;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const up = y > 0 ? pherPrev[i - W] : pherPrev[i];
        const down = y < H - 1 ? pherPrev[i + W] : pherPrev[i];
        const left = x > 0 ? pherPrev[i - 1] : pherPrev[i];
        const right = x < W - 1 ? pherPrev[i + 1] : pherPrev[i];
        const blurred = pherPrev[i] * (1 - d) + ((up + down + left + right) / 4) * d;
        pher[i] = blurred * keep;
      }
    }

    let collected = s.collected;
    const nextAnts = s.ants.map((ant) => {
      let { x, y, angle, carrying, trip } = ant;

      if (carrying) {
        angle = Math.atan2(NEST_Y - y, NEST_X - x) + rng.range(-0.15, 0.15);
        trip++;
      } else {
        const left = sense(pher, food, x, y, angle - SENSOR_ANGLE);
        const center = sense(pher, food, x, y, angle);
        const right = sense(pher, food, x, y, angle + SENSOR_ANGLE);
        if (left > center || right > center) {
          angle += (right > left ? 1 : -1) * 0.45;
        }
        angle += rng.range(-p.wiggle, p.wiggle);
      }

      let nx = x + Math.cos(angle);
      let ny = y + Math.sin(angle);
      if (nx < 0 || nx >= W) {
        angle = Math.PI - angle;
        nx = Math.min(W - 1e-3, Math.max(0, nx));
      }
      if (ny < 0 || ny >= H) {
        angle = -angle;
        ny = Math.min(H - 1e-3, Math.max(0, ny));
      }

      const cell = cellOf(nx, ny);
      if (carrying) {
        pher[cell] = Math.min(12, pher[cell] + Math.max(0.3, 3 * Math.exp(-trip / 80)));
        if (inNest(nx, ny)) {
          collected++;
          carrying = false;
          angle += Math.PI;
          trip = 0;
        }
      } else if (food[cell] > 0) {
        food[cell]--;
        carrying = true;
        trip = 0;
        angle += Math.PI;
      }

      return { x: nx, y: ny, angle, carrying, trip };
    });

    return {
      food: { w: W, h: H, cells: food },
      pher: { w: W, h: H, cells: pher },
      ants: nextAnts,
      collected,
      rngState: rng.state(),
      tick: s.tick + 1,
    };
  },

  render(s, ctx, view) {
    const food = s.food.cells;
    const pher = s.pher.cells;
    paintGrid(ctx, view, s.pher, "ants", (_, i) => {
      const fx = i % W;
      const fy = (i - fx) / W;
      if (inNest(fx + 0.5, fy + 0.5)) return C_NEST;
      if (food[i] > 0) return lerpRgb([30, 60, 30], [110, 235, 110], food[i] / 5);
      return lerpRgb(BG, TRAIL, Math.min(1, pher[i] / 5));
    });
    const kx = view.width / W;
    const ky = view.height / H;
    for (const ant of s.ants) {
      ctx.fillStyle = ant.carrying ? "#ffd966" : "#c7d2e0";
      ctx.fillRect(ant.x * kx - 1.5, ant.y * ky - 1.5, 3, 3);
    }
  },

  stats(s) {
    let remaining = 0;
    for (let i = 0; i < s.food.cells.length; i++) remaining += s.food.cells[i];
    let carrying = 0;
    for (const a of s.ants) if (a.carrying) carrying++;
    return {
      tick: s.tick,
      collected: s.collected,
      carrying,
      foodLeft: remaining,
    };
  },

  onPointer(s, x, y, _buttons) {
    const next = s.food.cells.slice();
    dropFood(next, Math.floor(x * W), Math.floor(y * H), 4, 5);
    return { ...s, food: { w: W, h: H, cells: next } };
  },
};
